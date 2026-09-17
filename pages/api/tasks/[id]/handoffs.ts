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
    const handoffs = await prisma.handoffRecord.findMany({
      where: { taskId },
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(handoffs);
  } catch (err) {
    console.error('[Tasks HANDOFFS]', err);
    res.status(500).json({ error: 'Failed to fetch handoffs' });
  }
}

export default withAuth(handler);
