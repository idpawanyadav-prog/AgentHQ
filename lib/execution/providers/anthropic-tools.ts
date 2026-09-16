import type { ApiToolProviderAdapter, ApiConversationMessage, NormalizedToolCall, ProviderRequestInput } from './types';

function anthropicMessages(messages: ApiConversationMessage[]) {
	const output: any[] = [];
	for (const message of messages) {
		if (message.role === 'tool') {
			output.push({ role: 'user', content: [{ type: 'tool_result', tool_use_id: message.toolCallId, content: message.content }] });
		} else if (message.role === 'assistant' && message.toolCalls?.length) {
			output.push({
				role: 'assistant',
				content: [
					...(message.content ? [{ type: 'text', text: message.content }] : []),
					...message.toolCalls.map((call) => ({ type: 'tool_use', id: call.id, name: call.name, input: call.arguments || {} })),
				],
			});
		} else {
			output.push({ role: message.role === 'assistant' ? 'assistant' : 'user', content: message.content });
		}
	}
	return output;
}

export const anthropicToolsAdapter: ApiToolProviderAdapter = {
	buildRequest(input: ProviderRequestInput) {
		return {
			model: input.modelId,
			max_tokens: input.maxTokens,
			temperature: input.temperature ?? 0.2,
			system: input.systemPrompt,
			messages: anthropicMessages(input.messages),
			tools: input.tools.map((tool) => ({
				name: tool.name,
				description: tool.description,
				input_schema: tool.parameters,
			})),
		};
	},
	parseResponse(result: any) {
		const content = Array.isArray(result?.content) ? result.content : [];
		const text = content.filter((item: any) => item.type === 'text').map((item: any) => item.text || '').join('\n');
		const toolCalls: NormalizedToolCall[] = content
			.filter((item: any) => item.type === 'tool_use')
			.map((item: any) => ({ id: String(item.id), name: String(item.name), arguments: item.input && typeof item.input === 'object' ? item.input : {} }));
		const inputTokens = result?.usage?.input_tokens ?? 0;
		const outputTokens = result?.usage?.output_tokens ?? 0;
		return {
			text,
			toolCalls,
			usage: { inputTokens, outputTokens, totalTokens: inputTokens + outputTokens },
			stopReason: result?.stop_reason,
			raw: result,
		};
	},
};
