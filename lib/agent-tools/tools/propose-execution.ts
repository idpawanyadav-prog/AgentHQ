import prisma from '../../prisma';
import { enqueueExecutionJob } from '../../job-queue';
import { recordProposal, type ProposalRecord } from '../../proposal-store';
import { resolveAgentModel } from '../../configured-models';
import type { AgentToolDefinition, AgentToolResult } from '../types';

export const proposeExecutionTool: AgentToolDefinition = {
	name: 'propose_execution',
	description: 'Propose an agent execution run for a task. Creates an ExecutionProposal that can be reviewed and applied.',
	inputSchema: {
		type: 'object',
		properties: {
			taskId: { type: 'string' },
			agentId: { type: 'string' },
			engine: { type: 'string' },
			prompt: { type: 'string' },
			branch: { type: 'string' },
		},
		required: ['taskId'],
	},
	risk: 'high',
	approvalMode: 'proposal',
	allowedActors: ['project-control'],
	async execute(args) {
		const taskId = String(args.taskId);
		const agentId = args.agentId ? String(args.agentId) : null;
		const engine = String(args.engine || 'crewai');
		const prompt = String(args.prompt || 'Execute the assigned task.');
		const branch = args.branch ? String(args.branch) : null;

		const task = await prisma.task.findUnique({
			where: { id: taskId },
			include: { project: { include: { team: true } } },
		});
		if (!task) {
			return { ok: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` } };
		}

		let configuredModelId: string | null = null;
		let gatewayId: string | null = null;
		if (agentId) {
			const agent = await prisma.agent.findUnique({ where: { id: agentId } });
			if (!agent) {
				return { ok: false, error: { code: 'AGENT_NOT_FOUND', message: `Agent ${agentId} not found.` } };
			}
			const model = await resolveAgentModel(agent);
			configuredModelId = model.configuredModel?.id || null;
			gatewayId = model.gatewayId || null;
		}

		const proposalId = `proposal_execution_${Date.now()}`;
		const proposal = await prisma.executionProposal.create({
			data: {
				projectId: task.projectId,
				taskId,
				agentId: agentId || undefined,
				engine,
				mode: 'proposed',
				prompt,
				branch,
				configuredModelId: configuredModelId || undefined,
				status: 'pending',
			},
		});

		const data: Record<string, unknown> = {
			type: 'execution',
			proposalId: proposal.id,
			taskId,
			projectId: task.projectId,
			projectName: task.project?.name,
			taskTitle: task.title,
			agentId,
			engine,
			prompt,
			branch,
			configuredModelId,
			implications: 'Agent will execute the task in the project workspace. Ensure the repository is configured.',
		};

		return {
			ok: true,
			data,
			proposalId: proposal.id,
			message: `Execution proposed: "${task.title}" via ${engine}. Approval required before execution.`,
		};
	},
};

export async function applyExecution(proposalId: string): Promise<AgentToolResult> {
	try {
		const proposal = await prisma.executionProposal.findUnique({
			where: { id: proposalId },
			include: { project: { include: { team: true } } },
		});
		if (!proposal) {
			return { ok: false, error: { code: 'PROPOSAL_NOT_FOUND', message: `Execution proposal ${proposalId} not found.` } };
		}
		if (proposal.status !== 'pending') {
			return { ok: false, error: { code: 'PROPOSAL_ALREADY_ACTED', message: `Proposal is already ${proposal.status}.` } };
		}
		await prisma.executionProposal.update({
			where: { id: proposalId },
			data: { status: 'approved', approvedAt: new Date() },
		});
		const workspace = await prisma.workspace.findFirst({ where: { projectId: proposal.projectId } });
		if (!workspace) {
			return { ok: false, error: { code: 'NO_WORKSPACE', message: 'No workspace found for the project. Configure a workspace before execution.' } };
		}
		const agentId = proposal.agentId || 'unassigned';
		const taskId = proposal.taskId;
		const teamId = proposal.project.teamId;
		const job = await enqueueExecutionJob({
			executionRunId: '',
			proposalId: proposal.id,
			projectId: proposal.projectId,
			taskId: taskId || undefined,
			agentId: agentId !== 'unassigned' ? agentId : undefined,
			teamId,
			workspaceId: workspace.id,
			engine: proposal.engine,
			configuredModelId: proposal.configuredModelId || undefined,
			status: 'queued',
		});
		await prisma.executionProposal.update({ where: { id: proposalId }, data: { status: 'applied', appliedAt: new Date() } });
		return { ok: true, data: { message: `Execution approved and queued. Job ${job.id} is ready.`, proposalId, jobId: job.id, projectId: proposal.projectId }, message: `Execution approved, job ${job.id} queued.` };
	} catch (err) {
		return { ok: false, error: { code: 'APPLY_ERROR', message: err instanceof Error ? err.message : 'Failed to apply execution proposal' } };
	}
}
