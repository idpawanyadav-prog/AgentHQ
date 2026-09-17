import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

export const getCheckpointTool: AgentToolDefinition = {
	name: 'get_latest_checkpoint',
	description: 'Read the latest ExecutionCheckpoint for a given execution run.',
	inputSchema: {
		type: 'object',
		properties: {
			executionRunId: { type: 'string' },
		},
		required: ['executionRunId'],
	},
	risk: 'read',
	approvalMode: 'none',
	allowedActors: ['project-control', 'agent', 'worker'],
	async execute(args): Promise<AgentToolResult> {
		const executionRunId = String(args.executionRunId);
		const checkpoint = await prisma.executionCheckpoint.findFirst({
			where: { executionRunId },
			orderBy: { createdAt: 'desc' },
		});
		if (!checkpoint) {
			return { ok: false, error: { code: 'NO_CHECKPOINT', message: `No checkpoint found for execution run ${executionRunId}.` } };
		}
		return { ok: true, data: checkpoint };
	},
};
