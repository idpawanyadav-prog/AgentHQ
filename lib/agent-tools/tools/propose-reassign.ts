import prisma from '../../prisma';
import { recordProposal } from '../../proposal-store';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

export const proposeReassignTool: AgentToolDefinition = {
	name: 'propose_task_reassignment',
	description: 'Propose reassigning a task to a different agent. Requires approval before execution.',
	inputSchema: {
		type: 'object',
		properties: {
			taskId: { type: 'string' },
			newAgentId: { type: 'string' },
		},
		required: ['taskId', 'newAgentId'],
	},
	risk: 'medium',
	approvalMode: 'proposal',
	allowedActors: ['project-control'],
	async execute(args): Promise<AgentToolResult> {
		const taskId = String(args.taskId);
		const newAgentId = String(args.newAgentId);

		const [task, agent] = await Promise.all([
			prisma.task.findUnique({ where: { id: taskId } }),
			prisma.agent.findUnique({ where: { id: newAgentId }, include: { member: true } }),
		]);

		if (!task) {
			return { ok: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` } };
		}
		if (!agent) {
			return { ok: false, error: { code: 'AGENT_NOT_FOUND', message: `Agent ${newAgentId} not found.` } };
		}

		if (agent.status !== 'idle') {
			return { ok: false, error: { code: 'AGENT_NOT_AVAILABLE', message: `Agent ${agent.name} is currently ${agent.status}.` } };
		}

		const proposalId = `proposal_reassign_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
		const data = {
			type: 'agent_reassignment',
			taskId,
			newAgentId,
			projectId: task.projectId,
			agentName: agent.name,
			reason: `Reassign to ${agent.name}`,
		};

		recordProposal({
			id: proposalId,
			toolName: 'propose_task_reassignment',
			arguments: args,
			context: { actorType: 'project-control' },
			result: { toolCallId: '', toolName: 'propose_task_reassignment', ok: true, data },
			createdAt: new Date(),
			ttlMs: 24 * 60 * 60 * 1000,
		});

		return {
			ok: true,
			data: { ...data, proposalId },
			message: `Reassignment of task ${task.title} to ${agent.name} proposed.`,
			proposalId,
		};
	},
};
