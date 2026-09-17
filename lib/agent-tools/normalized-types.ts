export type NormalizedToolCall = {
	id: string;
	name: string;
	arguments: Record<string, unknown>;
};

export type NormalizedToolResult = {
	toolCallId: string;
	toolName: string;
	ok: boolean;
	data?: unknown;
	error?: {
		code: string;
		message: string;
	};
	proposalId?: string;
	implications?: unknown;
};
