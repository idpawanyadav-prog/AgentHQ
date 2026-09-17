import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const sprintId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!sprintId) return res.status(400).json({ error: 'Sprint id is required' });

  try {
    const sprint = await prisma.sprint.update({
      where: { id: sprintId },
      data: {
        status: 'active',
        startDate: new Date(),
      },
    });

    res.status(200).json(sprint);
  } catch (err) {
    console.error('[Sprints START]', err);
    res.status(500).json({ error: 'Failed to start sprint' });
  }
}

export default withAuth(handler);
