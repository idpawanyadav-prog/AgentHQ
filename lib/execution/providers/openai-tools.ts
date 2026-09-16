import type { ApiToolProviderAdapter, NormalizedToolCall, ProviderRequestInput } from './types';

function parseArguments(value: unknown): Record<string, unknown> {
	if (!value) return {};
	if (typeof value === 'object') return value as Record<string, unknown>;
	if (typeof value === 'string') {
		try {
			const parsed = JSON.parse(value);
			return parsed && typeof parsed === 'object' ? parsed : {};
		} catch {
			return {};
		}
	}
	return {};
}

export const openAiToolsAdapter: ApiToolProviderAdapter = {
	buildRequest(input: ProviderRequestInput) {
		return {
			model: input.modelId,
			max_tokens: input.maxTokens,
			temperature: input.temperature ?? 0.2,
			messages: [
				{ role: 'system', content: input.systemPrompt },
				...input.messages.map((message) => {
					if (message.role === 'tool') return { role: 'tool', tool_call_id: message.toolCallId, content: message.content };
					if (message.role === 'assistant' && message.toolCalls?.length) {
						return {
							role: 'assistant',
							content: message.content || '',
							tool_calls: message.toolCalls.map((call) => ({
								id: call.id,
								type: 'function',
								function: { name: call.name, arguments: JSON.stringify(call.arguments || {}) },
							})),
						};
					}
					return { role: message.role, content: message.content };
				}),
			],
			tools: input.tools.map((tool) => ({ type: 'function', function: tool })),
			tool_choice: 'auto',
		};
	},
	parseResponse(result: any) {
		const message = result?.choices?.[0]?.message || {};
		const calls: NormalizedToolCall[] = Array.isArray(message.tool_calls)
			? message.tool_calls.map((call: any) => ({
				id: String(call.id || `tool-${Math.random().toString(36).slice(2)}`),
				name: String(call.function?.name || call.name || ''),
				arguments: parseArguments(call.function?.arguments || call.arguments),
			})).filter((call: NormalizedToolCall) => call.name)
			: [];
		const inputTokens = result?.usage?.prompt_tokens ?? result?.usage?.input_tokens ?? 0;
		const outputTokens = result?.usage?.completion_tokens ?? result?.usage?.output_tokens ?? 0;
		return {
			text: typeof message.content === 'string' ? message.content : '',
			toolCalls: calls,
			usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
			stopReason: result?.choices?.[0]?.finish_reason,
			raw: result,
		};
	},
};
