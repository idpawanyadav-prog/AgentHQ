import path from 'path';
import type { AgentExecutionEngine, EngineExecutionInput, EngineValidationInput } from '../engine';
import { writeFileTool } from '../../tools/file-tools';
import { runCommandTool } from '../../tools/command-tools';

export class FakeExecutionEngine implements AgentExecutionEngine {
	name = 'fake';
	private cancelled = new Set<string>();

	async validate(input: EngineValidationInput) {
		return { ok: input.tools.writeFile, reasons: input.tools.writeFile ? [] : ['Fake engine needs writeFile permission'] };
	}

	async execute(input: EngineExecutionInput) {
		if (this.cancelled.has(input.runId)) {
			return { status: 'cancelled' as const, output: 'Cancelled before execution', usage: {}, changedFiles: [], artifacts: [], commands: [], timedOut: false };
		}
		if (input.taskPrompt.includes('SIMULATE_TIMEOUT')) {
			return { status: 'timeout' as const, output: 'Simulated timeout', usage: { totalTokens: 10 }, changedFiles: [], artifacts: [], commands: [], timedOut: true, failureReason: 'Simulated timeout' };
		}
		if (input.taskPrompt.includes('SIMULATE_FAILURE')) {
			return { status: 'failed' as const, output: 'Simulated failure', usage: { totalTokens: 10 }, changedFiles: [], artifacts: [], commands: [], timedOut: false, failureReason: 'Simulated failure' };
		}
		const fileName = path.join('agenthq-runtime', `${input.runId}.txt`);
		await writeFileTool(input.workspacePath, fileName, `Run: ${input.runId}\nProject: ${input.projectId}\nPrompt: ${input.taskPrompt}\n`);
		const commands = [];
		if (input.commandPolicy.allowedCommands.some((argv) => argv.join(' ') === 'git status --short')) {
			const result = await runCommandTool(input.workspacePath, ['git', 'status', '--short'], input.commandPolicy);
			commands.push({ argv: result.argv, exitCode: result.exitCode, durationMs: result.durationMs });
		}
		return {
			status: 'success' as const,
			output: 'Fake execution completed and wrote a deterministic artifact.',
			usage: { inputTokens: 12, outputTokens: 8, totalTokens: 20 },
			changedFiles: [fileName.replace(/\\/g, '/')],
			artifacts: [{ type: 'file', path: fileName.replace(/\\/g, '/') }],
			commands,
			exitCode: 0,
			timedOut: false,
		};
	}

	async cancel(runId: string) {
		this.cancelled.add(runId);
	}
}
