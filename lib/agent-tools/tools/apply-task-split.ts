import type { AgentToolDefinition } from '../types';
import { applyTaskSplit } from './propose-task-split';

export const applyTaskSplitTool: AgentToolDefinition = {
	name: 'apply_task_split',
	description: 'Apply a previously proposed task split and create the sub-tasks.',
	inputSchema: {
		type: 'object',
		properties: {
			proposalId: { type: 'string' },
		},
		required: ['proposalId'],
	},
	risk: 'medium',
	approvalMode: 'explicit',
	allowedActors: ['project-control', 'scrum-master'],
	async execute(args) {
		const proposalId = String(args.proposalId);
		return applyTaskSplit(proposalId);
	},
};
