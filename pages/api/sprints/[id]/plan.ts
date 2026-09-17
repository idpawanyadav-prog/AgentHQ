import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

const PRIORITY_ORDER: Record<string, number> = {
  critical: 0,
  high: 1,
  medium: 2,
  low: 3,
};

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const sprintId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!sprintId) return res.status(400).json({ error: 'Sprint id is required' });

  try {
    const sprint = await prisma.sprint.findUnique({
      where: { id: sprintId },
      include: {
        project: { include: { team: true } },
        tasks: {
          where: { status: { not: 'done' } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    const suggestedTasks = [...sprint.tasks].sort((a, b) => {
      const pa = PRIORITY_ORDER[a.priority] ?? 99;
      const pb = PRIORITY_ORDER[b.priority] ?? 99;
      if (pa !== pb) return pa - pb;
      return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
    });

    const capacityWarnings: string[] = [];
    const totalStoryPoints = suggestedTasks.reduce(
      (sum, t) => sum + (t.storyPoints || 0),
      0,
    );
    if (totalStoryPoints > 30) {
      capacityWarnings.push(
        `Total story points (${totalStoryPoints}) may exceed healthy sprint capacity`,
      );
    }
    const blockedTasks = suggestedTasks.filter((t) => t.blocked);
    if (blockedTasks.length > 0) {
      capacityWarnings.push(
        `${blockedTasks.length} task(s) are currently blocked`,
      );
    }

    res.status(200).json({
      sprintId: sprint.id,
      suggestedTasks,
      capacityWarnings,
    });
  } catch (err) {
    console.error('[Sprints PLAN]', err);
    res.status(500).json({ error: 'Failed to plan sprint' });
  }
}

export default withAuth(handler);
