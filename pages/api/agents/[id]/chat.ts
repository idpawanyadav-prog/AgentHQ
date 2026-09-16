import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';
import { decrypt } from '../../../../lib/secrets';
import { safeFetch } from '../../../../lib/safe-fetch';
import { parseSafeUrl } from '../../../../lib/ssrf-guard';
import { resolveAgentModel } from '../../../../lib/configured-models';

type ChatMessage = {
	role: 'user' | 'assistant';
	content: string;
};

function textFromProviderResult(result: any, provider: string) {
	const normalizeContent = (content: any): string => {
		if (typeof content === 'string') return content;
		if (Array.isArray(content)) {
			return content.map((item) => {
				if (typeof item === 'string') return item;
				if (typeof item?.text === 'string') return item.text;
				if (typeof item?.content === 'string') return item.content;
				if (typeof item?.output_text === 'string') return item.output_text;
				return '';
			}).filter(Boolean).join('\n');
		}
		if (typeof content?.text === 'string') return content.text;
		if (typeof content?.content === 'string') return content.content;
		return '';
	};
	if (provider === 'anthropic') {
		return normalizeContent(result.content).trim();
	}
	return (
		normalizeContent(result.choices?.[0]?.message?.content)
		|| normalizeContent(result.choices?.[0]?.text)
		|| normalizeContent(result.output_text)
		|| normalizeContent(result.output?.[0]?.content)
		|| normalizeContent(result.message?.content)
		|| normalizeContent(result.content)
		|| normalizeContent(result.response)
		|| normalizeContent(result.candidates?.[0]?.content?.parts)
	).trim();
}

function usageFromProviderResult(result: any) {
	const promptTokens = result.usage?.input_tokens ?? result.usage?.prompt_tokens ?? 0;
	const completionTokens = result.usage?.output_tokens ?? result.usage?.completion_tokens ?? 0;
	return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
}

export default withAuth(async (req: NextApiRequest, res: NextApiResponse) => {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	if (typeof req.query.id !== 'string') return res.status(400).json({ error: 'Agent ID required' });

	const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
	const history = Array.isArray(req.body?.history) ? req.body.history as ChatMessage[] : [];
	if (!message) return res.status(400).json({ error: 'Message is required' });

	const agent = await prisma.agent.findUnique({ where: { id: req.query.id }, include: { member: true } });
	if (!agent) return res.status(404).json({ error: 'Agent not found' });

	const { config, configuredModel, gatewayId, modelId, provider } = await resolveAgentModel(agent);
	const gateway = gatewayId
		? await prisma.gateway.findUnique({ where: { id: gatewayId } })
		: await prisma.gateway.findFirst({
			where: { OR: [{ provider: agent.type }, { provider: 'custom' }] },
			orderBy: { isDefault: 'desc' },
		});
	if (gatewayId && !gateway) {
		return res.status(400).json({ error: 'Configured gateway for this agent was not found. Re-save the model or agent.' });
	}
	const resolvedProvider = configuredModel?.provider || gateway?.provider || provider;
	const providerMode = resolvedProvider === 'anthropic' ? 'anthropic' : 'openai';
	const key = gateway ? decrypt(gateway.apiKey) : providerMode === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
	if (!key) return res.status(400).json({ error: 'Configure a provider gateway before chatting with this agent' });

	const defaultBase = providerMode === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com';
	let rawBase = gateway?.baseUrl || defaultBase;
	if (gateway?.baseUrl) {
		const safe = await parseSafeUrl(gateway.baseUrl);
		rawBase = safe.url.toString();
	}
	const base = rawBase.replace(/\/+$/, '').replace(/\/v1$/, '');
	const systemPrompt = config.systemPrompt || `You are ${agent.name}, an agent in the ${agent.member.role} role. Answer as this office agent and be concise, practical, and task-focused.`;
	const messages = [
		...history
			.filter((item) => ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
			.slice(-12)
			.map((item) => ({ role: item.role, content: item.content })),
		{ role: 'user' as const, content: message },
	];

	await prisma.agent.update({ where: { id: agent.id }, data: { status: 'working' } });
	const startedAt = Date.now();

	try {
		const response = await safeFetch(base + (providerMode === 'anthropic' ? '/v1/messages' : '/v1/chat/completions'), {
			method: 'POST',
			headers: providerMode === 'anthropic'
				? { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }
				: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
			body: JSON.stringify({
				model: modelId,
				max_tokens: config.maxTokens || 2048,
				temperature: config.temperature,
				...(providerMode === 'anthropic'
					? { system: systemPrompt, messages }
					: { messages: [{ role: 'system', content: systemPrompt }, ...messages] }),
			}),
		});

		if (!response.ok) {
			const details = await response.text().catch(() => '');
			throw new Error(`Gateway returned HTTP ${response.status}${details ? `: ${details.slice(0, 240)}` : ''}`);
		}

		const result = await response.json();
		const reply = textFromProviderResult(result, providerMode);
		if (!reply) {
			throw new Error('Gateway returned a successful response, but no message text was found in it');
		}
		const usage = usageFromProviderResult(result);
		await prisma.$transaction([
			prisma.agent.update({ where: { id: agent.id }, data: { status: 'idle' } }),
			prisma.activity.create({
				data: {
					teamId: agent.member.teamId,
					memberId: agent.memberId,
					type: 'agent_message',
					description: `${agent.name} replied in Agent Office`,
					meta: JSON.stringify({ agentId: agent.id, provider: resolvedProvider, model: modelId, gatewayId: gateway?.id, configuredModelId: configuredModel?.id, usage, latencyMs: Date.now() - startedAt }),
				},
			}),
		]);
		return res.json({ reply, usage, provider: resolvedProvider, model: modelId });
	} catch (err) {
		await prisma.agent.update({ where: { id: agent.id }, data: { status: 'error' } }).catch(() => undefined);
		return res.status(500).json({ error: err instanceof Error ? err.message : 'Gateway chat failed' });
	}
});
