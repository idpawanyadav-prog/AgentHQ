import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const teamId = typeof req.query.teamId === 'string' ? req.query.teamId : null;
  const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : null;

  try {
    const teamWhere = teamId ? { id: teamId } : {};
    const projectWhere = projectId
      ? { id: projectId }
      : teamId
        ? { teamId }
        : {};

    const [projects, teams, sprints, agents, tasks, executions, blockers] =
      await Promise.all([
        prisma.project.findMany({
          where: projectWhere,
          include: { team: true },
          orderBy: { updatedAt: 'desc' },
        }),
        teamId
          ? prisma.team.findMany({ where: { id: teamId } })
          : prisma.team.findMany(),
        prisma.sprint.findMany({
          where: projectWhere,
          include: { project: true, _count: { select: { tasks: true } } },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.agent.findMany({
          where: teamId ? { member: { teamId } } : {},
          include: { member: true },
          orderBy: { createdAt: 'desc' },
        }),
        prisma.task.findMany({
          where: projectWhere,
          include: { project: true, sprint: true },
          orderBy: { updatedAt: 'desc' },
        }),
        prisma.executionRun.findMany({
          where: projectId ? { projectId } : {},
          include: { project: true },
          orderBy: { createdAt: 'desc' },
          take: 50,
        }),
        prisma.task.findMany({
          where: { ...projectWhere, blocked: true },
          include: { project: true },
          orderBy: { updatedAt: 'desc' },
        }),
      ]);

    const agentTeamIds = new Set(
      agents
        .map((a) => a.member?.teamId)
        .filter((t): t is string => typeof t === 'string'),
    );
    const relevantTeamIds = teamId
      ? [teamId]
      : Array.from(agentTeamIds).concat(teams.map((t) => t.id));
    const uniqueTeamIds = Array.from(new Set(relevantTeamIds));

    const recentActivities = await prisma.activity.findMany({
      where: uniqueTeamIds.length > 0
        ? { teamId: { in: uniqueTeamIds } }
        : {},
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    const normalizedAgents = agents.map((a) => ({
      ...a,
      status: a.status,
    }));

    res.status(200).json({
      projects,
      teams,
      sprints,
      agents: normalizedAgents,
      tasks,
      executions,
      blockers,
      recentActivities,
    });
  } catch (err) {
    console.error('[AgentOffice CONTEXT]', err);
    res.status(500).json({ error: 'Failed to load agent office context' });
  }
}

export default withAuth(handler);
