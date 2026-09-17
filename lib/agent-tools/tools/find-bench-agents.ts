import prisma from '../../prisma';
import type { AgentToolDefinition, AgentToolContext, AgentToolResult } from '../../agent-tools/types';

function roleKeywordScore(agentRole: string, targetRole: string): number {
  const agentWords = agentRole.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  const targetWords = targetRole.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').split(/\s+/).filter((w) => w.length > 2);
  if (!targetWords.length) return 0;
  const matches = targetWords.filter((w) => agentWords.some((aw) => aw.includes(w) || w.includes(aw)));
  return Math.round((matches.length / targetWords.length) * 50);
}

function skillScore(agentSkillNames: string[], requiredSkills: string[]): number {
  if (!requiredSkills.length) return 30;
  const lowerAgent = agentSkillNames.map((s) => s.toLowerCase());
  const matched = requiredSkills.filter((rs) => lowerAgent.some((as) => as.includes(rs.toLowerCase()) || rs.toLowerCase().includes(as)));
  return Math.round((matched.length / requiredSkills.length) * 50);
}

export const findBenchAgentsTool: AgentToolDefinition = {
  name: 'find_bench_agents',
  description: 'Find qualified agents on the bench matching a role and required skills. Bench agents are not currently assigned to a project team.',
  inputSchema: {
    type: 'object',
    properties: {
      role: { type: 'string' },
      requiredSkills: { type: 'array', items: { type: 'string' } },
      preferredSkills: { type: 'array', items: { type: 'string' } },
      count: { type: 'integer' },
    },
    required: ['role'],
  },
  risk: 'read',
  approvalMode: 'none',
  allowedActors: ['project-control'],
  async execute(args) {
    const role = String(args.role || '');
    const requiredSkills = Array.isArray(args.requiredSkills) ? args.requiredSkills.map(String) : [];
    const preferredSkills = Array.isArray(args.preferredSkills) ? args.preferredSkills.map(String) : [];
    const count = typeof args.count === 'number' ? Math.max(1, Math.min(args.count, 20)) : 5;

    const benchTeam = await prisma.team.findUnique({
      where: { id: 'on-bench' },
      include: {
        members: {
          include: {
            agents: {
              include: {
                member: true,
                tasks: { where: { status: { in: ['in_progress', 'review', 'testing'] } } },
              },
            },
          },
        },
      },
    });

    if (!benchTeam) {
      return { ok: true, data: { matches: [], missingCount: 0, totalAvailable: 0 } };
    }

    const allAgentIds = benchTeam.members.flatMap((m) => m.agents.map((a) => a.id));
    const assignments = allAgentIds.length
      ? await prisma.agentRoleAssignment.findMany({
          where: { agentId: { in: allAgentIds } },
          include: { roleGroup: { include: { skills: true } } },
        })
      : [];
    const assignmentMap = new Map(assignments.map((a) => [a.agentId, a.roleGroup]));

    const benchAgents = benchTeam.members.flatMap((m) =>
      m.agents.map((a) => ({
        agentId: a.id,
        name: a.name,
        status: a.status,
        role: m.role,
        activeTaskCount: a.tasks.length,
        skillNames: assignmentMap.get(a.id)?.skills.map((s) => s.name) || [],
        roleGroupId: assignmentMap.get(a.id)?.id || null,
      }))
    );

    const scored = benchAgents
      .filter((a) => a.status !== 'working' && a.activeTaskCount < 3)
      .map((a) => ({
        ...a,
        score: roleKeywordScore(a.role, role) + skillScore(a.skillNames, [...requiredSkills, ...preferredSkills]),
      }))
      .sort((a, b) => b.score - a.score)
      .slice(0, count);

    const matches = scored.map((s) => ({
      agentId: s.agentId,
      name: s.name,
      score: Math.min(s.score, 100),
      role: s.role,
      matchedSkills: [...requiredSkills, ...preferredSkills].filter((rs) =>
        s.skillNames.some((sn) => sn.toLowerCase().includes(rs.toLowerCase()) || rs.toLowerCase().includes(sn.toLowerCase()))
      ),
      roleGroupId: s.roleGroupId,
    }));

    return {
      ok: true,
      data: {
        matches,
        missingCount: Math.max(0, count - matches.length),
        totalAvailable: benchAgents.filter((a) => a.status !== 'working' && a.activeTaskCount < 3).length,
      },
    };
  },
};
