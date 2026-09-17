import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

export const getHandoffTool: AgentToolDefinition = {
	name: 'get_task_handoff',
	description: 'Read the latest HandoffRecord for a project or specific task.',
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

		const where: Record<string, string> = { projectId };
		if (taskId) where.taskId = taskId;

		const handoff = await prisma.handoffRecord.findFirst({
			where,
			orderBy: { createdAt: 'desc' },
		});

		if (!handoff) {
			return { ok: false, error: { code: 'NO_HANDOFF', message: 'No handoff record found.' } };
		}
		return { ok: true, data: handoff };
	},
};
