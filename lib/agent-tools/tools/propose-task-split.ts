import prisma from '../../prisma';
import { recordProposal } from '../../proposal-store';
import type { AgentToolDefinition, AgentToolResult } from '../types';

export const proposeTaskSplitTool: AgentToolDefinition = {
	name: 'propose_task_split',
	description: 'Propose splitting a large task into smaller sub-tasks.',
	inputSchema: {
		type: 'object',
		properties: {
			parentTaskId: { type: 'string' },
			count: { type: 'integer' },
			splitBy: { type: 'string', enum: ['size', 'type', 'manual'] },
			labels: { type: 'array', items: { type: 'string' } },
		},
		required: ['parentTaskId', 'count'],
	},
	risk: 'medium',
	approvalMode: 'proposal',
	allowedActors: ['project-control', 'scrum-master'],
	async execute(args) {
		const parentTaskId = String(args.parentTaskId);
		const count = typeof args.count === 'number' ? Math.max(2, Math.min(args.count, 20)) : 2;
		const splitBy = args.splitBy ? String(args.splitBy) : 'size';
		const labels = Array.isArray(args.labels) ? args.labels : [];
		const parentTask = await prisma.task.findUnique({
			where: { id: parentTaskId },
			include: { project: true, sprint: true, dependencies: true },
		});
		if (!parentTask) {
			return { ok: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${parentTaskId} not found.` } };
		}
		const subTasks: Record<string, unknown>[] = [];
		for (let i = 0; i < count; i++) {
			const label = labels[i] || `Part ${i + 1}`;
			subTasks.push({
				title: `${parentTask.title} — ${label}`,
				description: parentTask.description || `Sub-task ${i + 1} of ${parentTask.title}`,
				priority: parentTask.priority,
				storyPoints: Math.max(1, (parentTask.storyPoints || count) / count),
				type: parentTask.type,
			});
		}
		const proposalId = `proposal_task_split_${Date.now()}`;
		const data = {
			type: 'task_split',
			parentTaskId,
			parentTitle: parentTask.title,
			projectId: parentTask.projectId,
			sprintId: parentTask.sprintId,
			splitBy,
			count,
			subTasks,
			totalNewPoints: subTasks.reduce((s, t) => s + (t.storyPoints as number), 0),
		};
		recordProposal({
			id: proposalId, toolName: 'propose_task_split', arguments: args, context: { actorType: 'project-control', now: new Date() } as any,
			result: { toolCallId: '', toolName: 'propose_task_split', ok: true, data }, ttlMs: 24 * 60 * 60 * 1000,
		});
		return { ok: true, data: { ...data, proposalId }, message: `Proposed splitting "${parentTask.title}" into ${count} sub-tasks.` };
	},
};

export async function applyTaskSplit(proposalId: string): Promise<AgentToolResult> {
	const proposal = consumeProposal(proposalId);
	if (!proposal) {
		return { ok: false, error: { code: 'PROPOSAL_NOT_FOUND', message: `Proposal ${proposalId} not found or expired.` } };
	}
	const d = proposal.result.data as Record<string, unknown>;
	try {
		const parentTaskId = String(d.parentTaskId);
		const parent = await prisma.task.findUnique({ where: { id: parentTaskId } });
		if (!parent) {
			return { ok: false, error: { code: 'PARENT_TASK_NOT_FOUND', message: `Parent task ${parentTaskId} not found.` } };
		}
		const parentDep = JSON.parse(parent.dependencies || '[]');
		const subTaskIds: string[] = [];
		const subTasks = (d.subTasks as Record<string, unknown>[]);
		await prisma.task.update({
			where: { id: parentTaskId },
			data: { dependencies: JSON.stringify([...parentDep, ...subTasks.map((_, i) => `temp_${i}`)]) },
		});
		for (let i = 0; i < subTasks.length; i++) {
			const st = subTasks[i];
			const created = await prisma.task.create({
				data: {
					title: String(st.title),
					description: st.description as string | null,
					type: (st.type as string) || 'task',
					priority: (st.priority as string) || 'medium',
					storyPoints: st.storyPoints as number | null,
					projectId: String(d.projectId),
					teamId: parent.teamId,
					sprintId: d.sprintId as string | null,
					status: 'backlog',
					dependencies: JSON.stringify([parentTaskId]),
					blocked: false,
				},
			});
			subTaskIds.push(created.id);
		}
		await prisma.task.update({ where: { id: parentTaskId }, data: { dependencies: JSON.stringify(subTaskIds) } });
		await prisma.task.update({ where: { id: parentTaskId }, data: { status: 'done' } });
		return { ok: true, data: { parentTaskId, subTaskIds, count: subTaskIds.length, message: `Split into ${subTaskIds.length} sub-tasks.` } };
	} catch (err) {
		return { ok: false, error: { code: 'APPLY_ERROR', message: err instanceof Error ? err.message : 'Failed to apply task split' } };
	}
}
