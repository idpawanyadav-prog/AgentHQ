import fs from 'fs/promises';
import path from 'path';

const PROTECTED_SEGMENTS = new Set(['.git', '.ssh', '.aws', '.azure', '.config', '.docker', '.kube']);
const PROTECTED_FILENAMES = new Set(['.env', '.npmrc', '.netrc', '.git-credentials']);
const PROTECTED_EXTENSIONS = ['.pem', '.key', '.p12', '.pfx'];

export async function ensureWorkspacePath(workspaceRoot: string, requestedPath = '.') {
	const root = path.resolve(workspaceRoot);
	const target = path.resolve(root, requestedPath);
	const rootReal = await fs.realpath(root);
	let targetReal: string;
	try {
		targetReal = await fs.realpath(target);
	} catch {
		let existingParent = path.dirname(target);
		const missingParts = [path.basename(target)];
		while (existingParent !== path.dirname(existingParent)) {
			try {
				const parentReal = await fs.realpath(existingParent);
				targetReal = path.join(parentReal, ...missingParts.reverse());
				break;
			} catch {
				missingParts.push(path.basename(existingParent));
				existingParent = path.dirname(existingParent);
			}
		}
		if (!targetReal!) throw new Error('Path escapes workspace boundary');
	}
	const relative = path.relative(rootReal, targetReal);
	if (relative.startsWith('..') || path.isAbsolute(relative)) {
		throw new Error('Path escapes workspace boundary');
	}
	const parts = relative.split(path.sep).filter(Boolean);
	const basename = path.basename(targetReal);
	if (parts.some((part) => PROTECTED_SEGMENTS.has(part))) throw new Error('Protected path is not accessible');
	if (PROTECTED_FILENAMES.has(basename) || basename.startsWith('.env.')) throw new Error('Protected credential file is not accessible');
	if (PROTECTED_EXTENSIONS.some((ext) => basename.endsWith(ext))) throw new Error('Protected credential file is not accessible');
	return targetReal;
}

export function isTextBuffer(buffer: Buffer) {
	return !buffer.includes(0);
}
