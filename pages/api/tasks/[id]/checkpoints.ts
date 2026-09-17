import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const taskId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!taskId) return res.status(400).json({ error: 'Task id is required' });

  try {
    const runs = await prisma.executionRun.findMany({
      where: { taskId },
      select: { id: true },
    });

    const runIds = runs.map((r) => r.id);

    const checkpoints = await prisma.executionCheckpoint.findMany({
      where: { executionRunId: { in: runIds } },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(checkpoints);
  } catch (err) {
    console.error('[Tasks CHECKPOINTS]', err);
    res.status(500).json({ error: 'Failed to fetch checkpoints' });
  }
}

export default withAuth(handler);
