import type { AgentToolDefinition } from '../types';
import { applyTask } from './propose-task';

export const applyTaskTool: AgentToolDefinition = {
	name: 'apply_task',
	description: 'Apply a previously proposed task and create it in the database.',
	inputSchema: {
		type: 'object',
		properties: {
			proposalId: { type: 'string' },
		},
		required: ['proposalId'],
	},
	risk: 'medium',
	approvalMode: 'explicit',
	allowedActors: ['project-control'],
	async execute(args) {
		const proposalId = String(args.proposalId);
		return applyTask(proposalId);
	},
};
