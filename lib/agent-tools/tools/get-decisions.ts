import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

export const getDecisionsTool: AgentToolDefinition = {
	name: 'get_relevant_decisions',
	description: 'Read active DecisionRecords for a project, optionally filtered by task.',
	inputSchema: {
		type: 'object',
		properties: {
			projectId: { type: 'string' },
			taskId: { type: 'string' },
		},
		required: ['projectId'],
	},
	risk: 'read',
	approvalMode: 'none',
	allowedActors: ['project-control', 'agent'],
	async execute(args): Promise<AgentToolResult> {
		const projectId = String(args.projectId);
		const taskId = args.taskId ? String(args.taskId) : null;

		const where: Record<string, string> = { projectId, status: 'active' };
		if (taskId) where.taskId = taskId;

		const decisions = await prisma.decisionRecord.findMany({
			where,
			orderBy: { createdAt: 'desc' },
		});

		return { ok: true, data: decisions };
	},
};
