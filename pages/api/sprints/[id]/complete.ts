import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { writeSprintSummary } from '../../../../lib/memory/memory-service';

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
        project: true,
        tasks: true,
      },
    });

    if (!sprint) return res.status(404).json({ error: 'Sprint not found' });

    const completed = sprint.tasks
      .filter((t) => t.status === 'done')
      .map((t) => t.title)
      .join(', ');
    const incomplete = sprint.tasks
      .filter((t) => t.status !== 'done')
      .map((t) => t.title)
      .join(', ');

    const updated = await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: 'completed',
        endDate: new Date(),
      },
      include: {
        project: true,
        tasks: true,
      },
    });

    await writeSprintSummary(prisma, {
      sprintId: sprint.id,
      projectId: sprint.projectId,
      goal: sprint.goal || null,
      completed: completed || null,
      incomplete: incomplete || null,
    });

    res.status(200).json(updated);
  } catch (err) {
    console.error('[Sprints COMPLETE]', err);
    res.status(500).json({ error: 'Failed to complete sprint' });
  }
}

export default withAuth(handler);
