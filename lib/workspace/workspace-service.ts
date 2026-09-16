import fs from 'fs/promises';
import path from 'path';
import { spawnSync } from 'child_process';
import prisma from '../prisma';

export const WORKSPACE_ROOT = process.env.AGENTHQ_WORKSPACE_ROOT || path.join(process.cwd(), '..', 'AgentHQData', 'workspaces');

function slugify(value: string) {
	return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'run';
}

function runGit(cwd: string, args: string[]) {
	const result = spawnSync('git', args, { cwd, encoding: 'utf8', windowsHide: true });
	return {
		ok: result.status === 0,
		stdout: result.stdout.trim(),
		stderr: result.stderr.trim(),
		status: result.status || 0,
	};
}

export function executionBranch(taskId: string | null | undefined, prompt: string) {
	return `agent/${taskId || 'project'}-${slugify(prompt)}`;
}

export async function prepareWorkspace(projectId: string, runId: string, options: { taskId?: string | null; prompt: string; repoUrl?: string | null; defaultBranch?: string | null }) {
	const workspacePath = path.resolve(WORKSPACE_ROOT, projectId, runId);
	if (workspacePath.startsWith(path.resolve(process.cwd()))) {
		throw new Error('Execution workspace must not be inside the AgentHQ source repository');
	}
	await fs.mkdir(workspacePath, { recursive: true });
	const branch = executionBranch(options.taskId, options.prompt);
	let baseCommit: string | undefined;
	if (options.repoUrl && options.repoUrl.trim()) {
		const clone = runGit(path.dirname(workspacePath), ['clone', '--branch', options.defaultBranch || 'main', options.repoUrl, workspacePath]);
		if (!clone.ok) throw new Error('Repository clone failed');
		baseCommit = runGit(workspacePath, ['rev-parse', 'HEAD']).stdout || undefined;
		runGit(workspacePath, ['checkout', '-b', branch]);
	} else {
		await fs.writeFile(path.join(workspacePath, 'README.md'), `# AgentHQ execution workspace\n\nProject: ${projectId}\nRun: ${runId}\n`, 'utf8');
		runGit(workspacePath, ['init']);
		runGit(workspacePath, ['config', 'user.email', 'agenthq@example.local']);
		runGit(workspacePath, ['config', 'user.name', 'AgentHQ Runtime']);
		runGit(workspacePath, ['add', 'README.md']);
		runGit(workspacePath, ['commit', '-m', 'workspace: initialize']);
		baseCommit = runGit(workspacePath, ['rev-parse', 'HEAD']).stdout || undefined;
		runGit(workspacePath, ['checkout', '-b', branch]);
	}
	const workspace = await prisma.workspace.create({
		data: {
			projectId,
			executionRunId: runId,
			path: workspacePath,
			branch,
			baseCommit,
			status: 'ready',
		},
	});
	await prisma.executionRun.update({ where: { id: runId }, data: { workspaceId: workspace.id } });
	await prisma.executionCheckpoint.create({
		data: {
			executionRunId: runId,
			phase: 'workspace_ready',
			gitCommit: baseCommit,
			metadata: JSON.stringify({ path: workspacePath, branch }),
		},
	});
	return workspace;
}

export function gitDiff(workspacePath: string) {
	return runGit(workspacePath, ['diff']).stdout;
}

export function gitCommittedDiff(workspacePath: string, baseCommit?: string | null, headCommit?: string | null) {
	if (baseCommit && headCommit) return runGit(workspacePath, ['diff', `${baseCommit}..${headCommit}`]).stdout;
	return gitDiff(workspacePath);
}

export function gitChangedFiles(workspacePath: string) {
	const output = runGit(workspacePath, ['status', '--short']).stdout;
	return output.split(/\r?\n/).map((line) => line.slice(3).trim()).filter(Boolean);
}

export function createLocalCommit(workspacePath: string, message: string) {
	runGit(workspacePath, ['add', '.']);
	const commit = runGit(workspacePath, ['commit', '-m', message]);
	const headCommit = runGit(workspacePath, ['rev-parse', 'HEAD']).stdout || undefined;
	return { committed: commit.ok, headCommit, output: commit.stderr || commit.stdout };
}
