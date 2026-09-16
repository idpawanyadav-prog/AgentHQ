export type ToolPolicy = {
	readFile: boolean;
	writeFile: boolean;
	listFiles: boolean;
	searchFiles: boolean;
	gitStatus: boolean;
	gitDiff: boolean;
	gitCommit: boolean;
	runCommand: boolean;
	networkAccess: 'none' | 'restricted' | 'allowlisted';
};

export type CommandPolicy = {
	allowedCommands: string[][];
	allowShell: boolean;
	maxDurationMs: number;
	maxOutputChars: number;
};

export type EngineValidationInput = {
	projectId: string;
	engine: string;
	workspacePath?: string;
	tools: ToolPolicy;
	commandPolicy: CommandPolicy;
};

export type EngineValidationResult = {
	ok: boolean;
	reasons: string[];
};

export type EngineExecutionInput = {
	runId: string;
	projectId: string;
	workspacePath: string;
	systemPrompt: string;
	taskPrompt: string;
	model: {
		configuredModelId?: string;
		provider?: string;
		modelId?: string;
		gatewayId?: string;
	};
	tools: ToolPolicy;
	commandPolicy: CommandPolicy;
	timeoutMs: number;
	maxToolTurns: number;
};

export type EngineExecutionResult = {
	status: 'success' | 'failed' | 'timeout' | 'cancelled';
	output: string;
	usage: {
		inputTokens?: number;
		outputTokens?: number;
		totalTokens?: number;
		costUsd?: number;
	};
	changedFiles: string[];
	artifacts: Array<{
		type: string;
		path?: string;
		metadata?: Record<string, unknown>;
	}>;
	commands: Array<{
		argv: string[];
		exitCode: number;
		durationMs: number;
	}>;
	exitCode?: number;
	timedOut: boolean;
	failureReason?: string;
};

export interface AgentExecutionEngine {
	name: string;
	validate(input: EngineValidationInput): Promise<EngineValidationResult>;
	execute(input: EngineExecutionInput): Promise<EngineExecutionResult>;
	cancel(runId: string): Promise<void>;
}

export const READ_ONLY_TOOL_POLICY: ToolPolicy = {
	readFile: false,
	writeFile: false,
	listFiles: false,
	searchFiles: false,
	gitStatus: false,
	gitDiff: false,
	gitCommit: false,
	runCommand: false,
	networkAccess: 'none',
};

export const DEVELOPER_TOOL_POLICY: ToolPolicy = {
	readFile: true,
	writeFile: true,
	listFiles: true,
	searchFiles: true,
	gitStatus: true,
	gitDiff: true,
	gitCommit: true,
	runCommand: true,
	networkAccess: 'restricted',
};

export const DEFAULT_COMMAND_POLICY: CommandPolicy = {
	allowedCommands: [
		['git', 'status', '--short'],
		['git', 'diff', '--stat'],
		['git', 'diff'],
		['git', 'log', '-n', '10', '--oneline'],
		['npm', 'test'],
		['npm', 'run', 'test'],
		['npm', 'run', 'typecheck'],
		['npm', 'run', 'lint'],
		['npm', 'run', 'build'],
		['npx', 'prisma', 'generate'],
	],
	allowShell: false,
	maxDurationMs: 600_000,
	maxOutputChars: 100_000,
};
