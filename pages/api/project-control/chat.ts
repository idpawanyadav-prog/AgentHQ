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
import { ensureAgentToolsRegistered, executeManagementToolCall } from '../../../lib/agent-tools/management-tools';
import { anthropicToolsAdapter, openAiToolsAdapter } from '../../../lib/execution/providers';
import type { ApiToolDefinition, ApiConversationMessage } from '../../../lib/execution/providers/types';

const MAX_TOOL_ROUNDS = 8;
const MAX_TOOL_RESULT_CHARS = 4000;

function textFromProviderResult(result: any, provider: string): string {
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

function toApiToolDefinition(tool: any): ApiToolDefinition {
	return {
		name: tool.name,
		description: tool.description,
		parameters: tool.inputSchema || {},
	};
}

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	const projectId = typeof req.body?.projectId === 'string' && req.body.projectId.trim() ? req.body.projectId.trim() : '';
	const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
	const persona = validatePersona(req.body?.persona);
	const history = normalizeHistory(req.body?.history);
	if (!message) return res.status(400).json({ error: 'Message is required' });
	if (message.length > 8000) return res.status(400).json({ error: 'Message must be 8000 characters or fewer' });

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

	let status = null;
	let staffingProposal = null;
	if (projectId) {
		status = await getProjectControlStatus(projectId);
		if (!status) return res.status(404).json({ error: 'Project not found' });
		const targetMatch = message.match(/\b(?:increase|reduce|set|team)\D+(\d+)\s+(?:ai\s+)?agents?\b/i);
		const targetAgentCount = targetMatch ? Number(targetMatch[1]) : undefined;
		staffingProposal = targetAgentCount !== undefined || /hire|staff|enough developers|capacity|reduce the team|increase the team/i.test(message)
			? await proposeStaffing(projectId, { requirement: message, targetAgentCount })
			: null;
	}

	const systemPrompt = buildProjectControlSystemPrompt(persona, status);
	ensureAgentToolsRegistered();
	const allTools = (await import('../../../lib/agent-tools/registry')).listAgentTools();
	const apiTools: ApiToolDefinition[] = allTools.map(toApiToolDefinition);
	const adapter = providerMode === 'anthropic' ? anthropicToolsAdapter : openAiToolsAdapter;

	const messages: ApiConversationMessage[] = [
		...history,
		{ role: 'user', content: message },
	];
	const startedAt = Date.now();

	try {
		let totalUsage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };
		for (let round = 0; round < MAX_TOOL_ROUNDS; round++) {
			const requestBody = adapter.buildRequest({
				modelId: configuredModel.modelId,
				systemPrompt,
				messages,
				tools: apiTools,
				maxTokens: 2048,
				temperature: 0.2,
			});
			const response = await safeFetch(base + (providerMode === 'anthropic' ? '/v1/messages' : '/v1/chat/completions'), {
				method: 'POST',
				signal: AbortSignal.timeout(120_000),
				headers: providerMode === 'anthropic'
					? { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }
					: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
				body: JSON.stringify(requestBody),
			});
			if (!response.ok) throw new Error(`Gateway request failed with HTTP ${response.status}`);
			const result = await response.json();
			const turn = adapter.parseResponse(result);
			totalUsage.promptTokens += turn.usage?.inputTokens || 0;
			totalUsage.completionTokens += turn.usage?.outputTokens || 0;
			totalUsage.totalTokens += turn.usage?.totalTokens || 0;
			if (turn.toolCalls.length === 0) {
				const reply = turn.text || '';
				if (!reply) throw new Error('Gateway returned no message text');
				const teamId = status?.team?.id;
				if (teamId) {
					await prisma.activity.create({
						data: {
							teamId,
							type: 'project_control_chat',
							description: `Project Control replied`,
							meta: JSON.stringify({ projectId: projectId || null, persona, provider: configuredModel.provider, model: configuredModel.modelId, usage: totalUsage, latencyMs: Date.now() - startedAt }),
						},
					});
				}
				return res.status(200).json({ reply, usage: totalUsage, provider: configuredModel.provider, model: configuredModel.modelId, requirementAnalysis, staffingProposal, projectId: projectId || null });
			}
			const toolCallMessages: ApiConversationMessage[] = [];
			for (const call of turn.toolCalls) {
				const toolResult = await executeManagementToolCall(call, { actorType: 'project-control', persona, projectId: projectId || null, now: new Date() });
				// TEMPORARY DEBUG LOGGING
				const toolLog = {
					toolName: call.name,
					arguments: call.arguments,
					ok: toolResult.ok,
					proposalId: toolResult.proposalId,
					data: typeof toolResult.data === 'string' ? toolResult.data : JSON.stringify(toolResult.data),
					error: toolResult.error,
				};
				console.log('[Project Control DEBUG]', JSON.stringify(toolLog));
				const resultText = typeof toolResult.data === 'string' ? toolResult.data
					: toolResult.error ? JSON.stringify(toolResult.error)
					: JSON.stringify(toolResult.data).slice(0, MAX_TOOL_RESULT_CHARS);
				toolCallMessages.push({ role: 'tool', content: resultText, toolCallId: call.id, toolName: call.name });
			}
			messages.push({ role: 'assistant', content: turn.text || '', toolCalls: turn.toolCalls });
			messages.push(...toolCallMessages);
		}
		throw new Error('Tool call limit reached');
	} catch (err) {
		console.error('[Project Control Chat]', err);
		return res.status(500).json({ error: err instanceof Error ? err.message : 'Project Control chat failed' });
	}
});
