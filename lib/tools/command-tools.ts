import type { CommandPolicy } from '../execution/engine';
import { runSupervisedCommand } from '../process/process-supervisor';

function sameArgv(a: string[], b: string[]) {
	return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function assertCommandAllowed(argv: string[], policy: CommandPolicy) {
	if (!argv.length) throw new Error('Command argv is required');
	if (policy.allowShell === false && /[;&|<>]/.test(argv.join(' '))) throw new Error('Shell metacharacters are not allowed');
	if (!policy.allowedCommands.some((allowed) => sameArgv(argv, allowed))) {
		throw new Error(`Command is not allowlisted: ${argv.join(' ')}`);
	}
}

export async function runCommandTool(workspaceRoot: string, argv: string[], policy: CommandPolicy, signal?: AbortSignal) {
	assertCommandAllowed(argv, policy);
	return runSupervisedCommand(argv, {
		cwd: workspaceRoot,
		timeoutMs: policy.maxDurationMs,
		maxOutputChars: policy.maxOutputChars,
		signal,
	});
}
