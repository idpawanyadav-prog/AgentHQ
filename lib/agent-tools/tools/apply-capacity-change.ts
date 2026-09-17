import type { AgentToolDefinition } from '../types';
import { applyCapacityChange } from './propose-capacity-change';

export const applyCapacityChangeTool: AgentToolDefinition = {
	name: 'apply_capacity_change',
	description: 'Apply a previously proposed capacity change (hire/remove agent).',
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
		return applyCapacityChange(proposalId);
	},
};
