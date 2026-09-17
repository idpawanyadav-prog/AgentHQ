import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolResult } from '../../types';

const PHASE_PRIORITY: Record<string, number> = {
	blocked: 0,
	reviewing: 1,
	testing: 2,
	building: 3,
	planning: 4,
	completed: 5,
};

export const getDeliveryStateTool: AgentToolDefinition = {
	name: 'get_project_delivery_state',
	description: 'Compute the delivery state for a project: phase, task counts, blocked items, and risks.',
	inputSchema: {
		type: 'object',
		properties: {
			projectId: { type: 'string' },
		},
		required: ['projectId'],
	},
	risk: 'read',
	approvalMode: 'none',
	allowedActors: ['project-control', 'scrum-master'],
	async execute(args): Promise<AgentToolResult> {
		const projectId = String(args.projectId);

		const project = await prisma.project.findUnique({
			where: { id: projectId },
			include: {
				tasks: true,
				sprints: { include: { tasks: true } },
				team: { include: { members: { include: { agents: true } } } },
			},
		});

		if (!project) {
			return { ok: false, error: { code: 'PROJECT_NOT_FOUND', message: `Project ${projectId} not found.` } };
		}

		const tasks = project.tasks;
		const now = Date.now();

		const taskCounts = {
			backlog: tasks.filter((t) => t.status === 'backlog').length,
			ready: tasks.filter((t) => t.status === 'ready').length,
			in_progress: tasks.filter((t) => t.status === 'in_progress').length,
			review: tasks.filter((t) => t.status === 'review').length,
			testing: tasks.filter((t) => t.status === 'testing').length,
			done: tasks.filter((t) => t.status === 'done').length,
			blocked: tasks.filter((t) => t.blocked || t.status === 'blocked').length,
		};

		const agentCount = project.team.members.reduce((sum, m) => sum + m.agents.length, 0);

		let phase: string = 'planning';
		if (taskCounts.blocked > 0) phase = 'blocked';
		else if (taskCounts.review + taskCounts.testing > 0) phase = 'reviewing';
		else if (taskCounts.in_progress > 0 || taskCounts.ready > 0) phase = 'building';
		else if (taskCounts.done > 0 && taskCounts.done === tasks.length) phase = 'completed';

		const risks: Array<{ id: string; severity: string; label: string; detail: string }> = [];
		const blockedTasks = tasks.filter((t) => t.blocked || t.status === 'blocked');
		if (blockedTasks.length > 0) {
			risks.push({ id: 'blocked', severity: 'high', label: 'Blocked tasks', detail: `${blockedTasks.length} task(s) blocked` });
		}
		const pastDue = tasks.filter((t) => t.dueDate && t.status !== 'done' && new Date(t.dueDate).getTime() < now);
		if (pastDue.length > 0) {
			risks.push({ id: 'past-due', severity: 'high', label: 'Past due tasks', detail: `${pastDue.length} task(s) past due` });
		}
		const unassigned = tasks.filter((t) => t.status !== 'done' && !t.agentId && !t.assigneeId);
		if (unassigned.length > 0) {
			risks.push({ id: 'unassigned', severity: 'medium', label: 'Unassigned work', detail: `${unassigned.length} task(s) without assignee` });
		}

		return {
			ok: true,
			data: {
				projectId,
				projectName: project.name,
				phase,
				taskCounts,
				agentCount,
				blockedCount: taskCounts.blocked,
				risks,
				summary: {
					total: tasks.length,
					completed: taskCounts.done,
					active: taskCounts.in_progress + taskCounts.ready,
				},
			},
		};
	},
};
