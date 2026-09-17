import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolResult } from '../types';

export const getExecutionStatusTool: AgentToolDefinition = {
	name: 'get_execution_status',
	description: 'Get the current status of an execution run or proposal.',
	inputSchema: {
		type: 'object',
		properties: {
			proposalId: { type: 'string' },
			runId: { type: 'string' },
			taskId: { type: 'string' },
			projectId: { type: 'string' },
		},
	},
	risk: 'read',
	approvalMode: 'none',
	allowedActors: ['project-control', 'agent', 'worker'],
	async execute(args) {
		if (args.runId) {
			const runId = String(args.runId);
			const run = await prisma.executionRun.findUnique({
				where: { id: runId },
				include: { project: true, toolEvents: true, checkpoints: true },
			});
			if (!run) {
				return { ok: false, error: { code: 'EXECUTION_RUN_NOT_FOUND', message: `Execution run ${runId} not found.` } };
			}
			return { ok: true, data: {
				id: run.id,
				taskId: run.taskId,
				agentId: run.agentId,
				projectId: run.projectId,
				projectName: run.project?.name,
				engine: run.engine,
				status: run.status,
				outcome: run.outcome,
				startedAt: run.startedAt,
				finishedAt: run.finishedAt,
				durationMs: run.startedAt && run.finishedAt ? run.finishedAt.getTime() - run.startedAt.getTime() : null,
				tokens: { input: run.inputTokens, output: run.outputTokens, total: run.totalTokens },
				costUsd: run.costUsd,
				commandCount: JSON.parse(run.commands || '[]').length,
				checkpointCount: run.checkpoints.length,
				toolEventCount: run.toolEvents.length,
				resultSummary: run.resultSummary,
				failureReason: run.failureReason,
			} };
		}

		if (args.proposalId) {
			const proposalId = String(args.proposalId);
			const proposal = await prisma.executionProposal.findUnique({ where: { id: proposalId }, include: { project: true } });
			if (!proposal) {
				return { ok: false, error: { code: 'PROPOSAL_NOT_FOUND', message: `Proposal ${proposalId} not found.` } };
			}
			return { ok: true, data: {
				id: proposal.id,
				status: proposal.status,
				engine: proposal.engine,
				mode: proposal.mode,
				prompt: proposal.prompt,
				branch: proposal.branch,
				projectId: proposal.projectId,
				projectName: proposal.project?.name,
				taskId: proposal.taskId,
				agentId: proposal.agentId,
				createdAt: proposal.createdAt,
				approvedAt: proposal.approvedAt,
				appliedAt: proposal.appliedAt,
				rejectedAt: proposal.rejectedAt,
			} };
		}

		if (args.taskId || args.projectId) {
			const where: Record<string, unknown> = {};
			if (args.taskId) where.taskId = String(args.taskId);
			if (args.projectId) where.projectId = String(args.projectId);
			const [proposals, runs] = await Promise.all([
				prisma.executionProposal.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10, include: { project: true } }),
				prisma.executionRun.findMany({ where, orderBy: { createdAt: 'desc' }, take: 10 }),
			]);
			return { ok: true, data: { proposals, runs } };
		}

		return { ok: false, error: { code: 'INVALID_INPUT', message: 'Provide runId, proposalId, or taskId/projectId.' } };
	},
};
