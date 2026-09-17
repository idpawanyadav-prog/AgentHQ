import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolContext, AgentToolResult } from '../../agent-tools/types';

export const getTaskTool: AgentToolDefinition = {
  name: 'get_task',
  description: 'Get a single Task with its assignment, sprint, and agent context.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
    },
    required: ['taskId'],
  },
  risk: 'read',
  approvalMode: 'none',
  allowedActors: ['project-control', 'agent', 'worker'],
  async execute(args) {
    const taskId = String(args.taskId);
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: {
        assignee: true,
        agent: { include: { member: true } },
        sprint: true,
        project: true,
      },
    });

    if (!task) {
      return { ok: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` } };
    }

    return {
      ok: true,
      data: {
        id: task.id,
        title: task.title,
        description: task.description,
        type: task.type,
        priority: task.priority,
        status: task.status,
        storyPoints: task.storyPoints,
        acceptanceCriteria: task.acceptanceCriteria ? JSON.parse(task.acceptanceCriteria) : [],
        dueDate: task.dueDate,
        blocked: task.blocked,
        blockedReason: task.blockedReason,
        dependencies: JSON.parse(task.dependencies || '[]'),
        assignee: task.assignee ? { id: task.assignee.id, name: task.assignee.name, role: task.assignee.role } : null,
        agent: task.agent ? { id: task.agent.id, name: task.agent.name, model: task.agent.model } : null,
        sprint: task.sprint ? { id: task.sprint.id, name: task.sprint.name, status: task.sprint.status } : null,
        project: task.project ? { id: task.project.id, name: task.project.name } : null,
        branch: task.branch,
        prNumber: task.prNumber,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      },
    };
  },
};
