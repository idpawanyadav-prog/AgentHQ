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
    const where: Record<string, string> = {
      projectId,
      status: 'active',
    };

    const taskId = req.query.taskId;
    if (typeof taskId === 'string' && taskId.trim()) {
      where.taskId = taskId.trim();
    }

    const decisions = await prisma.decisionRecord.findMany({
      where,
      orderBy: { createdAt: 'desc' },
    });

    res.status(200).json(decisions);
  } catch (err) {
    console.error('[Projects DECISIONS]', err);
    res.status(500).json({ error: 'Failed to fetch decisions' });
  }
}

export default withAuth(handler);
