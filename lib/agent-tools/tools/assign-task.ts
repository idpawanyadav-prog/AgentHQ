import prisma from '../../prisma';
import { logActivity } from '../../activity-service';
import type { AgentToolDefinition, AgentToolResult } from '../types';

export const assignTaskTool: AgentToolDefinition = {
	name: 'assign_task',
	description: 'Assign a task to an agent and update its status.',
	inputSchema: {
		type: 'object',
		properties: {
			taskId: { type: 'string' },
			agentId: { type: 'string' },
			status: { type: 'string' },
		},
		required: ['taskId', 'agentId'],
	},
	risk: 'medium',
	approvalMode: 'explicit',
	allowedActors: ['project-control', 'scrum-master'],
	async execute(args) {
		const taskId = String(args.taskId);
		const agentId = String(args.agentId);
		const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: { include: { team: true } } } });
		if (!task) {
			return { ok: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` } };
		}
		const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { member: true } });
		if (!agent) {
			return { ok: false, error: { code: 'AGENT_NOT_FOUND', message: `Agent ${agentId} not found.` } };
		}
		if (task.teamId !== agent.member.teamId) {
			return { ok: false, error: { code: 'TEAM_MISMATCH', message: `Agent and task belong to different teams.` } };
		}
		const newStatus = args.status ? String(args.status) : 'ready';
		const validStatuses = ['backlog', 'ready', 'in_progress', 'review', 'testing', 'done', 'blocked'];
		const status = validStatuses.includes(newStatus) ? newStatus : 'ready';
		const updated = await prisma.task.update({
			where: { id: taskId },
			data: { agentId, status, assigneeId: agent.memberId },
			include: { agent: true, project: true },
		});
		if (task.projectId) {
			await logActivity({
				type: 'task_assigned',
				description: `Assigned task "${task.title}" to ${agent.name}`,
				meta: JSON.stringify({ taskId, agentId, status, agentName: agent.name }),
				teamId: task.teamId,
				taskId,
			});
		}
		return { ok: true, data: { id: updated.id, title: updated.title, agentId: updated.agentId, agentName: agent.name, status: updated.status, projectId: updated.projectId } };
	},
};
