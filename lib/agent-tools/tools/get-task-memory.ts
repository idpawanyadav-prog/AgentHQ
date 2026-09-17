import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

export const getTaskMemoryTool: AgentToolDefinition = {
	name: 'get_task_memory',
	description: 'Read the TaskMemory for a task, including objective, context, investigation, implementation, and remaining work.',
	inputSchema: {
		type: 'object',
		properties: {
			taskId: { type: 'string' },
		},
		required: ['taskId'],
	},
	risk: 'read',
	approvalMode: 'none',
	allowedActors: ['project-control', 'agent', 'worker'],
	async execute(args): Promise<AgentToolResult> {
		const taskId = String(args.taskId);
		const memory = await prisma.taskMemory.findUnique({ where: { taskId } });
		if (!memory) {
			return { ok: false, error: { code: 'NO_MEMORY', message: `No task memory found for task ${taskId}.` } };
		}
		return { ok: true, data: memory };
	},
};
