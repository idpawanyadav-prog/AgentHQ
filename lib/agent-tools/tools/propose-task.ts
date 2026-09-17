import prisma from '../../prisma';
import { recordProposal, consumeProposal } from '../../proposal-store';
import type { AgentToolDefinition, AgentToolResult } from '../types';

export const proposeTaskTool: AgentToolDefinition = {
	name: 'propose_task',
	description: 'Propose a new task for a project. Returns a proposalId for apply_task.',
	inputSchema: {
		type: 'object',
		properties: {
			projectId: { type: 'string' },
			sprintId: { type: 'string' },
			title: { type: 'string' },
			description: { type: 'string' },
			type: { type: 'string' },
			priority: { type: 'string' },
			storyPoints: { type: 'integer' },
			assigneeId: { type: 'string' },
			acceptanceCriteria: { type: 'array', items: { type: 'string' } },
		},
		required: ['projectId', 'title'],
	},
	risk: 'medium',
	approvalMode: 'proposal',
	allowedActors: ['project-control'],
	async execute(args) {
		const projectId = String(args.projectId);
		const project = await prisma.project.findUnique({ where: { id: projectId }, include: { team: true } });
		if (!project) {
			return { ok: false, error: { code: 'PROJECT_NOT_FOUND', message: `Project ${projectId} not found.` } };
		}
		const proposalId = `proposal_task_${Date.now()}`;
		const data = {
			type: 'task',
			projectId,
			teamId: project.teamId,
			sprintId: args.sprintId ? String(args.sprintId) : null,
			title: String(args.title).trim(),
			description: args.description ? String(args.description) : null,
			taskType: args.type ? String(args.type) : 'task',
			priority: args.priority ? String(args.priority) : 'medium',
			storyPoints: typeof args.storyPoints === 'number' ? args.storyPoints : null,
			assigneeId: args.assigneeId ? String(args.assigneeId) : null,
			acceptanceCriteria: Array.isArray(args.acceptanceCriteria) ? args.acceptanceCriteria : [],
		};
		recordProposal({
			id: proposalId,
			toolName: 'propose_task',
			arguments: args,
			context: { actorType: 'project-control', now: new Date() } as any,
			result: { toolCallId: '', toolName: 'propose_task', ok: true, data },
			createdAt: new Date(),
			ttlMs: 24 * 60 * 60 * 1000,
		});
		return { ok: true, data: { ...data, proposalId }, message: `Task "${data.title}" proposed for project ${project.name}.` };
	},
};

export async function applyTask(proposalId: string): Promise<AgentToolResult> {
	const proposal = consumeProposal(proposalId);
	if (!proposal) {
		return { ok: false, error: { code: 'PROPOSAL_NOT_FOUND', message: `Proposal ${proposalId} not found or expired.` } };
	}
	const d = proposal.result.data as Record<string, unknown>;
	try {
		const task = await prisma.task.create({
			data: {
				title: String(d.title),
				description: d.description as string | null,
				type: (d.taskType as string) || 'task',
				priority: (d.priority as string) || 'medium',
				storyPoints: d.storyPoints as number | null,
				projectId: String(d.projectId),
				teamId: String(d.teamId),
				sprintId: d.sprintId as string | null,
				assigneeId: d.assigneeId as string | null,
				acceptanceCriteria: JSON.stringify(d.acceptanceCriteria || []),
				status: 'backlog',
				dependencies: '[]',
				blocked: false,
			},
			include: { project: true, sprint: true, assignee: true },
		});
		return { ok: true, data: { id: task.id, title: task.title, projectId: task.projectId, sprintId: task.sprintId, status: task.status }, message: `Task "${task.title}" created successfully.` };
	} catch (err) {
		return { ok: false, error: { code: 'APPLY_ERROR', message: err instanceof Error ? err.message : 'Failed to create task' } };
	}
}
