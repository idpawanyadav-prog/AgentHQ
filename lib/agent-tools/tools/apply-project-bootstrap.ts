import type { AgentToolDefinition } from '../types';
import { applyProjectBootstrap } from './propose-project-bootstrap';

export const applyProjectBootstrapTool: AgentToolDefinition = {
	name: 'apply_project_bootstrap',
	description: 'Apply a previously proposed project bootstrap. The proposal must have been created via propose_project_bootstrap.',
	inputSchema: {
		type: 'object',
		properties: {
			proposalId: { type: 'string' },
		},
		required: ['proposalId'],
	},
	risk: 'high',
	approvalMode: 'explicit',
	allowedActors: ['project-control'],
	async execute(args) {
		const proposalId = String(args.proposalId);
		return applyProjectBootstrap(proposalId);
	},
};
