import prisma from '../../prisma';
import { decrypt } from '../../secrets';
import { safeFetch } from '../../safe-fetch';
import { parseSafeUrl } from '../../ssrf-guard';
import { readConfiguredModels } from '../../configured-models';
import type { AgentExecutionEngine, EngineExecutionInput } from '../engine';
import { anthropicToolsAdapter } from '../providers/anthropic-tools';
import { openAiToolsAdapter } from '../providers/openai-tools';
import type { ApiConversationMessage, ApiToolProviderAdapter } from '../providers/types';
import { API_TOOL_DEFINITIONS, executeApiTool } from '../tools/registry';

function usageAdd(total: { inputTokens: number; outputTokens: number; totalTokens: number; costUsd?: number }, next?: { inputTokens?: number; outputTokens?: number; totalTokens?: number; costUsd?: number }) {
	total.inputTokens += next?.inputTokens || 0;
	total.outputTokens += next?.outputTokens || 0;
	total.totalTokens += next?.totalTokens || ((next?.inputTokens || 0) + (next?.outputTokens || 0));
	if (typeof next?.costUsd === 'number') total.costUsd = (total.costUsd || 0) + next.costUsd;
}

async function resolveModel(configuredModelId?: string) {
	const models = await readConfiguredModels();
	const model = configuredModelId ? models.find((item) => item.id === configuredModelId) : models.find((item) => item.executionEngine === 'api-tools' || item.supportsTools) || models[0];
	if (!model) throw new Error('Configure a model before API tool execution.');
	if (model.executionEngine === 'api-chat' || model.supportsTools === false) throw new Error('Selected configured model does not support API tools.');
	const gateway = await prisma.gateway.findUnique({ where: { id: model.gatewayId } });
	if (!gateway) throw new Error('Configured model gateway not found.');
	return { model, gateway };
}

function adapterFor(provider: string): { adapter: ApiToolProviderAdapter; mode: 'anthropic' | 'openai' } {
	return provider === 'anthropic'
		? { adapter: anthropicToolsAdapter, mode: 'anthropic' }
		: { adapter: openAiToolsAdapter, mode: 'openai' };
}

export const apiToolsEngine: AgentExecutionEngine = {
	name: 'api-tools',
	async validate(input) {
		const reasons: string[] = [];
		if (!input.tools.readFile || !input.tools.writeFile || !input.tools.searchFiles) reasons.push('API tools coding needs file read/write/search permissions.');
		if (!input.tools.gitStatus || !input.tools.gitDiff) reasons.push('API tools coding needs git status/diff permissions.');
		return { ok: reasons.length === 0, reasons };
	},
	async execute(input: EngineExecutionInput) {
		const { model, gateway } = await resolveModel(input.model.configuredModelId);
		const { adapter, mode } = adapterFor(model.provider);
		const key = decrypt(gateway.apiKey);
		if (!key) throw new Error('Configured gateway API key is missing.');
		const defaultBase = mode === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com';
		let rawBase = gateway.baseUrl || defaultBase;
		if (gateway.baseUrl) {
			const safe = await parseSafeUrl(gateway.baseUrl);
			rawBase = safe.url.toString();
		}
		const base = rawBase.replace(/\/+$/, '').replace(/\/v1$/, '');
		const endpoint = base + (mode === 'anthropic' ? '/v1/messages' : '/v1/chat/completions');
		const messages: ApiConversationMessage[] = [{ role: 'user', content: input.taskPrompt }];
		const usage = { inputTokens: 0, outputTokens: 0, totalTokens: 0, costUsd: undefined as number | undefined };
		let finalText = '';

		for (let turn = 0; turn < input.maxToolTurns; turn += 1) {
			await prisma.executionRun.update({ where: { id: input.runId }, data: { heartbeatAt: new Date(), status: 'running' } });
			const controller = new AbortController();
			const timer = setTimeout(() => controller.abort(), Math.min(input.timeoutMs, 120_000));
			try {
				const response = await safeFetch(endpoint, {
					method: 'POST',
					signal: controller.signal,
					headers: mode === 'anthropic'
						? { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }
						: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
					body: JSON.stringify(adapter.buildRequest({
						modelId: model.modelId,
						systemPrompt: input.systemPrompt,
						messages,
						tools: API_TOOL_DEFINITIONS,
						maxTokens: 4096,
						temperature: 0.2,
					})),
				});
				if (!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
				const turnResult = adapter.parseResponse(await response.json());
				usageAdd(usage, turnResult.usage);
				finalText = turnResult.text || finalText;
				if (turnResult.toolCalls.length === 0) {
					return {
						status: 'success',
						output: finalText || 'API tool execution finished.',
						usage,
						changedFiles: [],
						artifacts: [{ type: 'model_response', metadata: { stopReason: turnResult.stopReason } }],
						commands: [],
						exitCode: 0,
						timedOut: false,
					};
				}
				messages.push({ role: 'assistant', content: turnResult.text || '', toolCalls: turnResult.toolCalls });
				for (const call of turnResult.toolCalls) {
					const toolResult = await executeApiTool({
						runId: input.runId,
						projectId: input.projectId,
						workspacePath: input.workspacePath,
						tools: input.tools,
						commandPolicy: input.commandPolicy,
					}, turn, call);
					messages.push({ role: 'tool', toolCallId: call.id, toolName: call.name, content: JSON.stringify(toolResult).slice(0, 12000) });
				}
			} finally {
				clearTimeout(timer);
			}
		}

		return {
			status: 'failed',
			output: finalText,
			usage,
			changedFiles: [],
			artifacts: [],
			commands: [],
			timedOut: false,
			failureReason: 'Maximum tool turns exceeded',
		};
	},
	async cancel() {},
};
