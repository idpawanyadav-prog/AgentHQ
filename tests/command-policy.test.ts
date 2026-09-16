import { assertCommandAllowed, runCommandTool } from '../lib/tools/command-tools';
import { DEFAULT_COMMAND_POLICY } from '../lib/execution/engine';

it('allows exact argv commands and rejects unknown commands', () => {
	expect(() => assertCommandAllowed(['git', 'status', '--short'], DEFAULT_COMMAND_POLICY)).not.toThrow();
	expect(() => assertCommandAllowed(['git', 'status'], DEFAULT_COMMAND_POLICY)).toThrow('not allowlisted');
});

it('rejects shell metacharacters when shell is disabled', () => {
	expect(() => assertCommandAllowed(['npm', 'test', '&&', 'echo', 'bad'], DEFAULT_COMMAND_POLICY)).toThrow('Shell metacharacters');
});

it('enforces timeout through the process supervisor', async () => {
	const result = await runCommandTool(process.cwd(), ['node', '-e', 'setTimeout(function(){}, 2000)'], {
		allowedCommands: [['node', '-e', 'setTimeout(function(){}, 2000)']],
		allowShell: false,
		maxDurationMs: 100,
		maxOutputChars: 1000,
	});
	expect(result.timedOut).toBe(true);
	expect(result.exitCode).not.toBe(0);
});
