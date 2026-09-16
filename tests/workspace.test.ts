import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { ensureWorkspacePath } from '../lib/workspace/path-policy';
import { readFileTool, writeFileTool } from '../lib/tools/file-tools';

async function tempWorkspace() {
	return fs.mkdtemp(path.join(os.tmpdir(), 'agenthq-workspace-'));
}

it('allows paths inside workspace and blocks traversal outside', async () => {
	const root = await tempWorkspace();
	await fs.writeFile(path.join(root, 'safe.txt'), 'ok', 'utf8');

	await expect(ensureWorkspacePath(root, 'safe.txt')).resolves.toContain('safe.txt');
	await expect(ensureWorkspacePath(root, '..')).rejects.toThrow('Path escapes workspace boundary');
});

it('rejects protected files and symlink escapes', async () => {
	const root = await tempWorkspace();
	await fs.writeFile(path.join(root, '.env'), 'SECRET=1', 'utf8');
	await expect(readFileTool(root, '.env')).rejects.toThrow('Protected credential file');

	const outside = await fs.mkdtemp(path.join(os.tmpdir(), 'agenthq-outside-'));
	await fs.writeFile(path.join(outside, 'outside.txt'), 'nope', 'utf8');
	const link = path.join(root, 'escape');
	const linked = await fs.symlink(path.join(outside, 'outside.txt'), link).then(() => true).catch(() => false);
	if (linked) await expect(readFileTool(root, 'escape')).rejects.toThrow('Path escapes workspace boundary');
});

it('writes bounded text files inside the workspace', async () => {
	const root = await tempWorkspace();
	await expect(writeFileTool(root, 'src/output.txt', 'hello')).resolves.toEqual({ path: path.join('src', 'output.txt') });
	await expect(readFileTool(root, 'src/output.txt')).resolves.toBe('hello');
});
