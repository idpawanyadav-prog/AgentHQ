import type { AgentExecutionEngine } from '../engine';

export const apiChatEngine: AgentExecutionEngine = {
	name: 'api-chat',
	async validate() {
		return { ok: true, reasons: [] };
	},
	async execute(input) {
		return {
			status: 'success',
			output: `Analysis-only execution recorded for: ${input.taskPrompt}`,
			usage: { totalTokens: 0 },
			changedFiles: [],
			artifacts: [],
			commands: [],
			exitCode: 0,
			timedOut: false,
		};
	},
	async cancel() {},
};
