import prisma from '../../prisma';
import { cancelJob } from '../../job-queue';
import { writeTaskMemory, writeHandoffRecord } from '../../memory/memory-service';
import { recordProposal } from '../../proposal-store';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

export const pauseTaskTool: AgentToolDefinition = {
	name: 'pause_task',
	description: 'Pause a running task, cancel its active execution job, save a checkpoint, and record a handoff.',
	inputSchema: {
		type: 'object',
		properties: {
			taskId: { type: 'string' },
			summary: { type: 'string' },
		},
		required: ['taskId'],
	},
	risk: 'high',
	approvalMode: 'proposal',
	allowedActors: ['project-control'],
	async execute(args): Promise<AgentToolResult> {
		const taskId = String(args.taskId);
		const summary = typeof args.summary === 'string' ? args.summary : 'Task paused by project control';

		const task = await prisma.task.findUnique({ where: { id: taskId } });
		if (!task) {
			return { ok: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` } };
		}

		const activeRun = await prisma.executionRun.findFirst({
			where: { taskId, status: 'running' },
			orderBy: { createdAt: 'desc' },
		});

		if (activeRun?.jobId) {
			try {
				await cancelJob(activeRun.jobId);
			} catch (err) {
				console.warn('[pause_task] cancelJob failed', err);
			}
		}

		const checkpoint = activeRun
			? await prisma.executionCheckpoint.create({
					data: {
						executionRunId: activeRun.id,
						phase: 'paused',
						taskStatus: 'paused',
						agentStatus: 'idle',
						metadata: JSON.stringify({ pausedAt: new Date().toISOString(), reason: 'pause_requested' }),
					},
			  })
			: null;

		if (task.projectId) {
			await writeTaskMemory(prisma, taskId, task.projectId, {
				objective: task.title,
				remainingWork: 'Paused',
				nextAction: 'Resume required',
				blockers: 'Paused by project control',
				lastAgentId: task.agentId ?? null,
			});
		}

		const handoff = await writeHandoffRecord(prisma, {
			projectId: task.projectId ?? '',
			taskId,
			fromAgentId: task.agentId ?? null,
			type: 'task_pause',
			summary,
			blockers: 'Paused by project control',
			remainingWork: 'Paused',
		});

		if (activeRun) {
			await prisma.executionRun.update({
				where: { id: activeRun.id },
				data: { status: 'paused', finishedAt: new Date() },
			});
		}

		await prisma.task.update({
			where: { id: taskId },
			data: { status: 'paused' },
		});

		if (task.agentId) {
			await prisma.agent.update({
				where: { id: task.agentId },
				data: { status: 'idle' },
			});
		}

		const proposalId = `proposal_pause_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
		recordProposal({
			id: proposalId,
			toolName: 'pause_task',
			arguments: args,
			context: {},
			result: { toolCallId: '', toolName: 'pause_task', ok: true, data: { paused: true, taskId, checkpointId: checkpoint?.id, handoffId: handoff.id } },
			createdAt: new Date(),
			ttlMs: 24 * 60 * 60 * 1000,
		});

		return { ok: true, data: { paused: true, taskId, checkpointId: checkpoint?.id, handoffId: handoff.id }, proposalId };
	},
};
