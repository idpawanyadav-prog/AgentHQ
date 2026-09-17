import prisma from '../../prisma';
import { getProjectControlStatus } from '../../project-control';
import type { AgentToolDefinition, AgentToolContext, AgentToolResult } from '../../agent-tools/types';

export const getProjectStatusTool: AgentToolDefinition = {
  name: 'get_project_status',
  description: 'Get the current status of an AgentHQ Project including team, tasks, sprints, agents, and risks.',
  inputSchema: {
    type: 'object',
    properties: {
      projectId: { type: 'string' },
    },
    required: ['projectId'],
  },
  risk: 'read',
  approvalMode: 'none',
  allowedActors: ['project-control', 'agent', 'worker'],
  async execute(args, context) {
    const projectId = String(args.projectId);
    const status = await getProjectControlStatus(projectId);
    if (!status) {
      return { ok: false, error: { code: 'PROJECT_NOT_FOUND', message: `Project ${projectId} not found.` } };
    }
    return { ok: true, data: status };
  },
};
