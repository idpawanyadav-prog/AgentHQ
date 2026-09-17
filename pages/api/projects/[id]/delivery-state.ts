import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const projectId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!projectId) return res.status(400).json({ error: 'Project id is required' });

  try {
    const project = await prisma.project.findUnique({
      where: { id: projectId },
    });
    if (!project) return res.status(404).json({ error: 'Project not found' });

    const [
      taskCounts,
      agentCount,
      blockedCount,
      sprints,
    ] = await Promise.all([
      prisma.task.groupBy({
        by: ['status'],
        where: { projectId },
        _count: { _all: true },
      }),
      prisma.agent.count({
        where: { member: { teamId: project.teamId } },
      }),
      prisma.task.count({
        where: { projectId, blocked: true },
      }),
      prisma.sprint.findMany({
        where: { projectId },
        include: { _count: { select: { tasks: true } } },
        orderBy: { order: 'asc' },
      }),
    ]);

    const counts: Record<string, number> = {
      backlog: 0,
      ready: 0,
      in_progress: 0,
      review: 0,
      testing: 0,
      done: 0,
      blocked: 0,
    };
    for (const row of taskCounts) {
      counts[row.status] = row._count._all;
    }

    let phase: 'planning' | 'building' | 'reviewing' | 'testing' | 'blocked' | 'completed' = 'planning';
    const activeSprint = sprints.find(s => s.status === 'active');
    const completedSprints = sprints.filter(s => s.status === 'completed');

    if (counts.blocked > 0 || blockedCount > 0) {
      phase = 'blocked';
    } else if (counts.done > 0 && counts.backlog === 0 && counts.ready === 0 && counts.in_progress === 0 && counts.review === 0 && counts.testing === 0) {
      phase = 'completed';
    } else if (activeSprint) {
      if (counts.review > 0 || counts.testing > 0) {
        phase = 'reviewing';
      } else if (counts.in_progress > 0) {
        phase = 'building';
      } else if (counts.testing > 0) {
        phase = 'testing';
      } else {
        phase = 'building';
      }
    } else if (completedSprints.length > 0) {
      phase = 'reviewing';
    }

    const risks: string[] = [];
    if (counts.blocked > 0 || blockedCount > 0) {
      risks.push(`${counts.blocked + blockedCount} task(s) are blocked`);
    }
    if (counts.in_progress > 0 && agentCount === 0) {
      risks.push('Tasks are in progress but no agents are available');
    }

    res.status(200).json({
      projectId: project.id,
      status: project.status,
      phase,
      taskCounts: counts,
      agentCount,
      blockedCount: counts.blocked + blockedCount,
      risks,
    });
  } catch (err) {
    console.error('[Projects DELIVERY-STATE]', err);
    res.status(500).json({ error: 'Failed to compute delivery state' });
  }
}

export default withAuth(handler);
