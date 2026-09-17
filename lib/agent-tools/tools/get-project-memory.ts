import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

export const getProjectMemoryTool: AgentToolDefinition = {
	name: 'get_project_memory',
	description: 'Read the ProjectMemory for a project, including mission, architecture, decisions, blockers, and next actions.',
	inputSchema: {
		type: 'object',
		properties: {
			projectId: { type: 'string' },
		},
		required: ['projectId'],
	},
	risk: 'read',
	approvalMode: 'none',
	allowedActors: ['project-control', 'agent'],
	async execute(args): Promise<AgentToolResult> {
		const projectId = String(args.projectId);
		const memory = await prisma.projectMemory.findUnique({ where: { projectId } });
		if (!memory) {
			return { ok: false, error: { code: 'NO_MEMORY', message: `No project memory found for project ${projectId}.` } };
		}
		return { ok: true, data: memory };
	},
};
