import fs from 'fs/promises';
import path from 'path';
import { ensureWorkspacePath, isTextBuffer } from '../workspace/path-policy';

const MAX_FILE_BYTES = 1_000_000;

export async function readFileTool(workspaceRoot: string, requestedPath: string) {
	const target = await ensureWorkspacePath(workspaceRoot, requestedPath);
	const stat = await fs.stat(target);
	if (!stat.isFile()) throw new Error('Path is not a file');
	if (stat.size > MAX_FILE_BYTES) throw new Error('File is too large to read');
	const buffer = await fs.readFile(target);
	if (!isTextBuffer(buffer)) throw new Error('Binary files are not supported');
	return buffer.toString('utf8');
}

export async function writeFileTool(workspaceRoot: string, requestedPath: string, content: string) {
	if (Buffer.byteLength(content, 'utf8') > MAX_FILE_BYTES) throw new Error('File write exceeds maximum size');
	const target = await ensureWorkspacePath(workspaceRoot, requestedPath);
	await fs.mkdir(path.dirname(target), { recursive: true });
	await fs.writeFile(target, content, 'utf8');
	return { path: path.relative(await fs.realpath(workspaceRoot), target) };
}

export async function listFilesTool(workspaceRoot: string, requestedPath = '.') {
	const target = await ensureWorkspacePath(workspaceRoot, requestedPath);
	const entries = await fs.readdir(target, { withFileTypes: true });
	return entries
		.filter((entry) => entry.name !== '.git')
		.map((entry) => ({ name: entry.name, type: entry.isDirectory() ? 'directory' : 'file' }));
}

export async function searchFilesTool(workspaceRoot: string, query: string) {
	const matches: string[] = [];
	const rootReal = await fs.realpath(workspaceRoot);
	async function walk(dir: string) {
		const entries = await fs.readdir(dir, { withFileTypes: true });
		for (const entry of entries) {
			if (entry.name === '.git') continue;
			const full = path.join(dir, entry.name);
			if (entry.isDirectory()) await walk(full);
			else if (entry.name.toLowerCase().includes(query.toLowerCase())) matches.push(path.relative(rootReal, full));
			if (matches.length >= 100) return;
		}
	}
	await walk(rootReal);
	return matches;
}
