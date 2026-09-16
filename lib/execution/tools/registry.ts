import prisma from '../../prisma';
import { readFileTool, listFilesTool, searchFilesTool, writeFileTool } from '../../tools/file-tools';
import { runCommandTool } from '../../tools/command-tools';
import { gitChangedFiles, gitDiff } from '../../workspace/workspace-service';
import type { ApiToolDefinition, ApiToolRuntimeInput, NormalizedToolCall } from '../providers/types';

export const API_TOOL_DEFINITIONS: ApiToolDefinition[] = [
	{ name: 'list_files', description: 'List files in the active project workspace.', parameters: { type: 'object', properties: { path: { type: 'string' } } } },
	{ name: 'read_file', description: 'Read a UTF-8 text file from the active project workspace.', parameters: { type: 'object', properties: { path: { type: 'string' } }, required: ['path'] } },
	{ name: 'search_files', description: 'Search workspace file names.', parameters: { type: 'object', properties: { query: { type: 'string' } }, required: ['query'] } },
	{ name: 'write_file', description: 'Create or replace a UTF-8 text file in the active project workspace.', parameters: { type: 'object', properties: { path: { type: 'string' }, content: { type: 'string' } }, required: ['path', 'content'] } },
	{ name: 'git_status', description: 'Return changed files in the workspace.', parameters: { type: 'object', properties: {} } },
	{ name: 'git_diff', description: 'Return current workspace git diff.', parameters: { type: 'object', properties: {} } },
	{ name: 'run_command', description: 'Run an allowlisted project command.', parameters: { type: 'object', properties: { argv: { type: 'array', items: { type: 'string' } } }, required: ['argv'] } },
	{ name: 'get_project_context', description: 'Get bounded AgentHQ project context.', parameters: { type: 'object', properties: {} } },
	{ name: 'get_task', description: 'Get current Task context.', parameters: { type: 'object', properties: {} } },
	{ name: 'get_sprint', description: 'Get current active Sprint context.', parameters: { type: 'object', properties: {} } },
	{ name: 'get_team', description: 'Get current Team and Agent roster context.', parameters: { type: 'object', properties: {} } },
	{ name: 'get_agent_context', description: 'Get current Agent role and Role Group context.', parameters: { type: 'object', properties: {} } },
];

function summarize(value: unknown) {
	const text = typeof value === 'string' ? value : JSON.stringify(value);
	return text.length > 4000 ? `${text.slice(0, 4000)}…` : text;
}

async function logToolEvent(runId: string, turn: number, call: NormalizedToolCall, status: string, startedAt: Date, result: unknown) {
	await prisma.executionToolEvent.create({
		data: {
			executionRunId: runId,
			turn,
			toolName: call.name,
			arguments: JSON.stringify(call.arguments || {}).slice(0, 2000),
			resultSummary: summarize(result).slice(0, 4000),
			status,
			startedAt,
			finishedAt: new Date(),
		},
	});
}

export async function executeApiTool(input: ApiToolRuntimeInput, turn: number, call: NormalizedToolCall) {
	const startedAt = new Date();
	try {
		const args = call.arguments || {};
		let result: unknown;
		if (call.name === 'list_files') {
			if (!input.tools.listFiles) throw new Error('list_files is not allowed');
			result = await listFilesTool(input.workspacePath, typeof args.path === 'string' ? args.path : '.');
		} else if (call.name === 'read_file') {
			if (!input.tools.readFile) throw new Error('read_file is not allowed');
			result = await readFileTool(input.workspacePath, String(args.path || ''));
		} else if (call.name === 'search_files') {
			if (!input.tools.searchFiles) throw new Error('search_files is not allowed');
			result = await searchFilesTool(input.workspacePath, String(args.query || ''));
		} else if (call.name === 'write_file') {
			if (!input.tools.writeFile) throw new Error('write_file is not allowed');
			result = await writeFileTool(input.workspacePath, String(args.path || ''), String(args.content || ''));
		} else if (call.name === 'git_status') {
			if (!input.tools.gitStatus) throw new Error('git_status is not allowed');
			result = { changedFiles: gitChangedFiles(input.workspacePath) };
		} else if (call.name === 'git_diff') {
			if (!input.tools.gitDiff) throw new Error('git_diff is not allowed');
			result = { diff: gitDiff(input.workspacePath).slice(0, 100_000) };
		} else if (call.name === 'run_command') {
			if (!input.tools.runCommand) throw new Error('run_command is not allowed');
			const argv = Array.isArray(args.argv) ? args.argv.map(String) : [];
			const command = await runCommandTool(input.workspacePath, argv, input.commandPolicy);
			result = { argv: command.argv, exitCode: command.exitCode, durationMs: command.durationMs, stdout: command.stdout.slice(-4000), stderr: command.stderr.slice(-4000) };
		} else if (call.name === 'get_project_context') {
			result = await prisma.project.findUnique({ where: { id: input.projectId }, include: { milestones: true, executionState: true } });
		} else if (call.name === 'get_task') {
			result = input.taskId ? await prisma.task.findUnique({ where: { id: input.taskId }, include: { sprint: true, assignee: true, agent: true } }) : null;
		} else if (call.name === 'get_sprint') {
			result = await prisma.sprint.findFirst({ where: { projectId: input.projectId, status: 'active' }, include: { tasks: true } });
		} else if (call.name === 'get_team') {
			const project = await prisma.project.findUnique({ where: { id: input.projectId }, include: { team: { include: { members: { include: { agents: true } } } } } });
			result = project?.team || null;
		} else if (call.name === 'get_agent_context') {
			result = input.agentId ? await prisma.agent.findUnique({ where: { id: input.agentId }, include: { member: true } }) : null;
		} else {
			throw new Error(`Unknown tool: ${call.name}`);
		}
		await logToolEvent(input.runId, turn, call, 'success', startedAt, result);
		return { ok: true, result };
	} catch (err) {
		const result = { ok: false, error: err instanceof Error ? err.message : 'Tool failed' };
		await logToolEvent(input.runId, turn, call, 'failed', startedAt, result);
		return result;
	}
}
