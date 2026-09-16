import { spawn } from 'child_process';

export type SupervisedCommandResult = {
	argv: string[];
	exitCode: number;
	durationMs: number;
	stdout: string;
	stderr: string;
	timedOut: boolean;
};

export function runSupervisedCommand(argv: string[], options: { cwd: string; timeoutMs: number; maxOutputChars: number; signal?: AbortSignal }): Promise<SupervisedCommandResult> {
	if (!argv.length) throw new Error('Command argv is required');
	const started = Date.now();
	return new Promise((resolve) => {
		let stdout = '';
		let stderr = '';
		let settled = false;
		let timedOut = false;
		const child = spawn(argv[0], argv.slice(1), {
			cwd: options.cwd,
			shell: false,
			windowsHide: true,
			detached: process.platform !== 'win32',
		});
		const append = (current: string, chunk: Buffer) => (current + chunk.toString('utf8')).slice(-options.maxOutputChars);
		const finish = (exitCode: number) => {
			if (settled) return;
			settled = true;
			clearTimeout(timer);
			options.signal?.removeEventListener('abort', abort);
			resolve({ argv, exitCode, durationMs: Date.now() - started, stdout, stderr, timedOut });
		};
		const terminate = () => {
			if (process.platform === 'win32') {
				spawn('taskkill', ['/pid', String(child.pid), '/t', '/f'], { windowsHide: true });
			} else {
				try { process.kill(-child.pid!, 'SIGTERM'); } catch { child.kill('SIGTERM'); }
			}
		};
		const abort = () => {
			timedOut = true;
			terminate();
		};
		const timer = setTimeout(abort, options.timeoutMs);
		options.signal?.addEventListener('abort', abort, { once: true });
		child.stdout?.on('data', (chunk) => { stdout = append(stdout, chunk); });
		child.stderr?.on('data', (chunk) => { stderr = append(stderr, chunk); });
		child.on('error', (error) => {
			stderr = append(stderr, Buffer.from(error.message));
			finish(1);
		});
		child.on('close', (code) => finish(typeof code === 'number' ? code : timedOut ? 124 : 1));
	});
}
