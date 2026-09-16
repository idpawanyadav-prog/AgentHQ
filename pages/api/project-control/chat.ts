import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import prisma from '../../../lib/prisma';
import { decrypt } from '../../../lib/secrets';
import { safeFetch } from '../../../lib/safe-fetch';
import { parseSafeUrl } from '../../../lib/ssrf-guard';
import { readConfiguredModels } from '../../../lib/configured-models';
import {
	analyzeRequirementMessage,
	buildProjectControlSystemPrompt,
	getProjectControlStatus,
	normalizeHistory,
	proposeStaffing,
	validatePersona,
} from '../../../lib/project-control';

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
	if (provider === 'anthropic') return normalizeContent(result.content).trim();
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

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
	const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
	const persona = validatePersona(req.body?.persona);
	const history = normalizeHistory(req.body?.history);
	if (!projectId) return res.status(400).json({ error: 'projectId is required' });
	if (!message) return res.status(400).json({ error: 'Message is required' });
	if (message.length > 8000) return res.status(400).json({ error: 'Message must be 8000 characters or fewer' });

	const status = await getProjectControlStatus(projectId);
	if (!status) return res.status(404).json({ error: 'Project not found' });
	const models = await readConfiguredModels();
	const configuredModel = models[0];
	if (!configuredModel) return res.status(400).json({ error: 'Configure a model before using Project Control.' });
	const gateway = await prisma.gateway.findUnique({ where: { id: configuredModel.gatewayId } });
	if (!gateway) return res.status(400).json({ error: 'Configured model gateway not found.' });
	const providerMode = configuredModel.provider === 'anthropic' ? 'anthropic' : 'openai';
	const key = decrypt(gateway.apiKey);
	if (!key) return res.status(400).json({ error: 'Configure a provider gateway before using Project Control.' });
	const defaultBase = providerMode === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com';
	let rawBase = gateway.baseUrl || defaultBase;
	if (gateway.baseUrl) {
		const safe = await parseSafeUrl(gateway.baseUrl);
		rawBase = safe.url.toString();
	}
	const base = rawBase.replace(/\/+$/, '').replace(/\/v1$/, '');
	const requirementAnalysis = analyzeRequirementMessage(message);
	const targetMatch = message.match(/\b(?:increase|reduce|set|team)\D+(\d+)\s+(?:ai\s+)?agents?\b/i);
	const targetAgentCount = targetMatch ? Number(targetMatch[1]) : undefined;
	const staffingProposal = targetAgentCount !== undefined || /hire|staff|enough developers|capacity|reduce the team|increase the team/i.test(message)
		? await proposeStaffing(projectId, { requirement: message, targetAgentCount })
		: null;
	const systemPrompt = buildProjectControlSystemPrompt(persona, status);
	const messages = [
		...history,
		{ role: 'user' as const, content: message },
	];
	const startedAt = Date.now();

	try {
		const response = await safeFetch(base + (providerMode === 'anthropic' ? '/v1/messages' : '/v1/chat/completions'), {
			method: 'POST',
			headers: providerMode === 'anthropic'
				? { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }
				: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
			body: JSON.stringify({
				model: configuredModel.modelId,
				max_tokens: 2048,
				temperature: 0.2,
				...(providerMode === 'anthropic'
					? { system: systemPrompt, messages }
					: { messages: [{ role: 'system', content: systemPrompt }, ...messages] }),
			}),
		});
		if (!response.ok) throw new Error(`Gateway request failed with HTTP ${response.status}`);
		const result = await response.json();
		const reply = textFromProviderResult(result, providerMode);
		if (!reply) throw new Error('Gateway returned no message text');
		const usage = usageFromProviderResult(result);
		await prisma.activity.create({
			data: {
				teamId: status.team.id,
				type: 'project_control_chat',
				description: `Project Control replied about ${status.project.name}`,
				meta: JSON.stringify({ projectId, persona, provider: configuredModel.provider, model: configuredModel.modelId, usage, latencyMs: Date.now() - startedAt }),
			},
		});
		return res.status(200).json({ reply, usage, provider: configuredModel.provider, model: configuredModel.modelId, requirementAnalysis, staffingProposal });
	} catch (err) {
		console.error('[Project Control Chat]', err);
		return res.status(500).json({ error: err instanceof Error ? err.message : 'Project Control chat failed' });
	}
});
