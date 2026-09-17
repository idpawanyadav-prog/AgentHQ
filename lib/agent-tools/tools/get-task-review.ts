import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

export const getTaskReviewTool: AgentToolDefinition = {
	name: 'get_task_review',
	description: 'Read the TaskReview for a task, including status, summary, and findings.',
	inputSchema: {
		type: 'object',
		properties: {
			taskId: { type: 'string' },
		},
		required: ['taskId'],
	},
	risk: 'read',
	approvalMode: 'none',
	allowedActors: ['project-control', 'agent'],
	async execute(args): Promise<AgentToolResult> {
		const taskId = String(args.taskId);
		const review = await prisma.taskReview.findUnique({ where: { taskId } });
		if (!review) {
			return { ok: false, error: { code: 'NO_REVIEW', message: `No review found for task ${taskId}.` } };
		}
		return { ok: true, data: review };
	},
};
