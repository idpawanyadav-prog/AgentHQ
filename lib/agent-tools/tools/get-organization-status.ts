import prisma from '../../prisma';
import { readConfiguredModels } from '../../configured-models';
import type { AgentToolDefinition, AgentToolContext, AgentToolResult } from '../../agent-tools/types';

export const getOrganizationStatusTool: AgentToolDefinition = {
  name: 'get_organization_status',
  description: 'Get organization-level status including all projects, bench agents, role groups, and configured models.',
  inputSchema: {
    type: 'object',
    properties: {
      includeBench: { type: 'boolean' },
      includeProjects: { type: 'boolean' },
    },
  },
  risk: 'read',
  approvalMode: 'none',
  allowedActors: ['project-control'],
  async execute(args, context) {
    const includeBench = args.includeBench !== false;
    const includeProjects = args.includeProjects !== false;
    const result: Record<string, unknown> = {};

    if (includeProjects) {
      const projects = await prisma.project.findMany({
        select: {
          id: true,
          name: true,
          status: true,
          progress: true,
          teamId: true,
          updatedAt: true,
        },
        orderBy: { createdAt: 'desc' },
      });
      result.projects = projects;
    }

    if (includeBench) {
      const benchTeam = await prisma.team.findUnique({
        where: { id: 'on-bench' },
        include: {
          members: {
            include: {
              agents: {
                include: {
                  member: true,
                  tasks: {
                    where: {
                      status: { in: ['backlog', 'ready', 'in_progress', 'review', 'testing', 'blocked'] },
                    },
                  },
                },
              },
            },
          },
        },
      });

      const benchAgents = benchTeam?.members.flatMap((m) =>
        m.agents.map((a) => ({
          id: a.id,
          name: a.name,
          status: a.status,
          role: m.role,
          type: a.type,
          model: a.model,
          activeTaskCount: a.tasks.length,
        }))
      ) || [];

      result.bench = {
        agentCount: benchAgents.length,
        agents: benchAgents,
      };
    }

    const roleGroups = await prisma.roleGroup.findMany({
      orderBy: { name: 'asc' },
      select: { id: true, name: true, description: true, color: true },
    });
    result.roleGroups = roleGroups;

    const models = await readConfiguredModels();
    result.configuredModels = models;

    return { ok: true, data: result };
  },
};
