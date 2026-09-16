import type { CommandPolicy, ToolPolicy } from '../engine';

export type NormalizedToolCall = {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
};

export type ApiModelTurn = {
	text?: string;
	toolCalls: NormalizedToolCall[];
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
		costUsd?: number;
	};
	stopReason?: string;
	raw?: unknown;
};

export type ApiToolDefinition = {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
};

export type ApiConversationMessage = {
	role: 'user' | 'assistant' | 'tool';
	content: string;
	toolCallId?: string;
	toolName?: string;
	toolCalls?: NormalizedToolCall[];
};

export type ProviderRequestInput = {
	modelId: string;
	systemPrompt: string;
	messages: ApiConversationMessage[];
	tools: ApiToolDefinition[];
	maxTokens: number;
	temperature?: number;
};

export type ApiToolProviderAdapter = {
	buildRequest(input: ProviderRequestInput): Record<string, unknown>;
	parseResponse(result: unknown): ApiModelTurn;
};

export type ApiToolRuntimeInput = {
	runId: string;
	projectId: string;
	taskId?: string | null;
	agentId?: string | null;
	workspacePath: string;
	tools: ToolPolicy;
	commandPolicy: CommandPolicy;
};
