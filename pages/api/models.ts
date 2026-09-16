import { withAuth } from '../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';

const MODELS_SETTING_KEY = 'configured_models';

type ConfiguredModelRecord = {
 id: string;
 name: string;
 gatewayId: string;
 gatewayName: string;
 provider: 'anthropic' | 'openai' | 'custom';
 modelId: string;
 executionEngine?: 'api-chat' | 'api-tools';
 supportsTools?: boolean;
 createdAt: string;
 updatedAt: string;
};

function parseAgentConfig(config: unknown): Record<string, any> {
 if (!config) return {};
 if (typeof config !== 'string') return config as Record<string, any>;
 try {
 return JSON.parse(config);
 } catch {
 return {};
 }
}

async function resolveModelInput(body: Record<string, unknown>) {
	const name = typeof body.name === 'string' ? body.name.trim() : '';
	const gatewayId = typeof body.gatewayId === 'string' ? body.gatewayId.trim() : '';
	const modelId = typeof body.modelId === 'string' ? body.modelId.trim() : '';
	if (!name || !gatewayId || !modelId) {
		return { ok: false as const, status: 400, error: 'Model name, gateway and selected model are required' };
	}
	const gateway = await prisma.gateway.findUnique({ where: { id: gatewayId } });
	if (!gateway) {
		return { ok: false as const, status: 404, error: 'Gateway not found' };
	}
	if (!['anthropic', 'openai', 'custom'].includes(gateway.provider)) {
		return { ok: false as const, status: 400, error: 'Gateway provider is not supported' };
	}
	return {
		ok: true as const,
		value: {
			name,
			gatewayId: gateway.id,
			gatewayName: gateway.name,
			provider: gateway.provider as ConfiguredModelRecord['provider'],
			modelId,
			executionEngine: body.executionEngine === 'api-tools' ? 'api-tools' as const : 'api-chat' as const,
			supportsTools: body.supportsTools === undefined ? body.executionEngine === 'api-tools' : body.supportsTools === true,
		},
	};
}

async function readConfiguredModels(): Promise<ConfiguredModelRecord[]> {
 const setting = await prisma.setting.findUnique({ where: { key: MODELS_SETTING_KEY } });
 if (!setting) return [];
 try {
 const parsed = JSON.parse(setting.value);
 return Array.isArray(parsed) ? parsed : [];
 } catch {
 return [];
 }
}

async function writeConfiguredModels(models: ConfiguredModelRecord[]) {
 await prisma.setting.upsert({
 where: { key: MODELS_SETTING_KEY },
 create: { key: MODELS_SETTING_KEY, value: JSON.stringify(models) },
 update: { value: JSON.stringify(models) },
 });
}

async function modelsWithAssignments(models: ConfiguredModelRecord[]) {
 const agents = await prisma.agent.findMany();
 return models.map((model) => {
 const assignedAgents = agents.filter((agent) => {
 const config = parseAgentConfig(agent.config);
 return config.configuredModelId === model.id;
 });
 return {
 ...model,
 assignments: assignedAgents.length,
 agentNames: assignedAgents.map((agent) => agent.name),
 };
 });
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
 if (req.method === 'GET') {
 const models = await readConfiguredModels();
 return res.status(200).json(await modelsWithAssignments(models));
 }

 if (req.method === 'POST') {
 const resolved = await resolveModelInput(req.body);
 if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
 const now = new Date().toISOString();
 const models = await readConfiguredModels();
 const model: ConfiguredModelRecord = {
 id: `model-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
 ...resolved.value,
 createdAt: now,
 updatedAt: now,
 };
 models.push(model);
 await writeConfiguredModels(models);
 return res.status(201).json({ ...model, assignments: 0, agentNames: [] });
 }

 if (req.method === 'PUT') {
 const { id } = req.body;
 if (typeof id !== 'string' || !id.trim()) return res.status(400).json({ error: 'Model id is required' });
 const resolved = await resolveModelInput(req.body);
 if (!resolved.ok) return res.status(resolved.status).json({ error: resolved.error });
 const models = await readConfiguredModels();
 const existing = models.find((model) => model.id === id);
 if (!existing) return res.status(404).json({ error: 'Model not found' });

 const next = models.map((model) =>
 model.id === id
 ? {
 ...model,
 ...resolved.value,
 updatedAt: new Date().toISOString(),
 }
 : model
 );
 await writeConfiguredModels(next);
 const saved = next.find((model) => model.id === id)!;
 const agents = await prisma.agent.findMany();
 await Promise.all(
 agents
 .filter((agent) => parseAgentConfig(agent.config).configuredModelId === id)
 .map((agent) => {
 const config = {
 ...parseAgentConfig(agent.config),
 gatewayId: saved.gatewayId,
 configuredModelId: saved.id,
 };
 return prisma.agent.update({
 where: { id: agent.id },
 data: {
 type: saved.provider,
 model: saved.modelId,
 config: JSON.stringify(config),
 },
 });
 })
 );
 const [withCounts] = await modelsWithAssignments([saved]);
 return res.status(200).json(withCounts);
 }

 if (req.method === 'DELETE') {
 const { id } = req.body;
 if (typeof id !== 'string' || !id.trim()) return res.status(400).json({ error: 'Model id is required' });
 const models = await readConfiguredModels();
 const existing = models.find((model) => model.id === id);
 if (!existing) return res.status(404).json({ error: 'Model not found' });

 const agents = await prisma.agent.findMany();
 const assignedAgents = agents.filter((agent) => parseAgentConfig(agent.config).configuredModelId === id);
 if (assignedAgents.length > 0) {
 return res.status(409).json({
 error: `Cannot delete model while assigned to ${assignedAgents.length} agent${assignedAgents.length === 1 ? '' : 's'}`,
 agentNames: assignedAgents.map((agent) => agent.name),
 });
 }

 await writeConfiguredModels(models.filter((model) => model.id !== id));
 return res.status(204).end();
 }

 res.setHeader('Allow', ['GET', 'POST', 'PUT', 'DELETE']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
}

export default withAuth(handler);
