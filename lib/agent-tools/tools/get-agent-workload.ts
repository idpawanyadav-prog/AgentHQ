import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolContext, AgentToolResult } from '../../agent-tools/types';

const ACTIVE_STATUSES = ['backlog', 'ready', 'in_progress', 'review', 'testing', 'blocked'];

export const getAgentWorkloadTool: AgentToolDefinition = {
  name: 'get_agent_workload',
  description: 'Get an Agent\'s workload including active task count, story points, blocked tasks, and capacity.',
  inputSchema: {
    type: 'object',
    properties: {
      agentId: { type: 'string' },
    },
    required: ['agentId'],
  },
  risk: 'read',
  approvalMode: 'none',
  allowedActors: ['project-control', 'agent', 'worker'],
  async execute(args) {
    const agentId = String(args.agentId);
    const agent = await prisma.agent.findUnique({
      where: { id: agentId },
      include: {
        member: true,
        tasks: { where: { status: { in: ACTIVE_STATUSES } } },
      },
    });

    if (!agent) {
      return { ok: false, error: { code: 'AGENT_NOT_FOUND', message: `Agent ${agentId} not found.` } };
    }

    const activeTaskCount = agent.tasks.length;
    const activeStoryPoints = agent.tasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
    const blockedTaskCount = agent.tasks.filter((t) => t.blocked || t.status === 'blocked').length;

    let capacity = 'Idle';
    if (agent.status === 'working') capacity = 'Busy';
    else if (blockedTaskCount > 0) capacity = 'Blocked';
    else if (activeTaskCount >= 4) capacity = 'Overloaded';
    else if (activeTaskCount > 0) capacity = 'Available';

    return {
      ok: true,
      data: {
        agentId: agent.id,
        name: agent.name,
        status: agent.status,
        role: agent.member.role,
        activeTaskCount,
        activeStoryPoints,
        blockedTaskCount,
        capacity,
        model: agent.model,
      },
    };
  },
};
