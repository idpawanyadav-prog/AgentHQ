import prisma from '../../prisma';
import { recordProposal } from '../../proposal-store';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

export const proposeResumeTaskTool: AgentToolDefinition = {
	name: 'propose_resume_task',
	description: 'Propose resuming a paused task. Requires approval before execution.',
	inputSchema: {
		type: 'object',
		properties: {
			taskId: { type: 'string' },
			agentId: { type: 'string' },
		},
		required: ['taskId'],
	},
	risk: 'medium',
	approvalMode: 'proposal',
	allowedActors: ['project-control'],
	async execute(args): Promise<AgentToolResult> {
		const taskId = String(args.taskId);
		const agentId = args.agentId ? String(args.agentId) : null;

		const task = await prisma.task.findUnique({ where: { id: taskId } });
		if (!task) {
			return { ok: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` } };
		}

		if (task.status !== 'paused') {
			return { ok: false, error: { code: 'TASK_NOT_PAUSED', message: `Task ${taskId} is not paused (current status: ${task.status}).` } };
		}

		if (agentId) {
			const agent = await prisma.agent.findUnique({ where: { id: agentId } });
			if (!agent) {
				return { ok: false, error: { code: 'AGENT_NOT_FOUND', message: `Agent ${agentId} not found.` } };
			}
		}

		const proposalId = `proposal_resume_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
		const data = {
			type: 'task_resume',
			taskId,
			agentId: agentId ?? null,
			projectId: task.projectId,
			reason: 'Resume paused task',
		};

		recordProposal({
			id: proposalId,
			toolName: 'propose_resume_task',
			arguments: args,
			context: { actorType: 'project-control' },
			result: { toolCallId: '', toolName: 'propose_resume_task', ok: true, data },
			createdAt: new Date(),
			ttlMs: 24 * 60 * 60 * 1000,
		});

		return {
			ok: true,
			data: { ...data, proposalId },
			message: `Resume of task ${taskId} proposed.`,
			proposalId,
		};
	},
};
