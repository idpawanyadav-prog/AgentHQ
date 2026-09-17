import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const agentId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!agentId) return res.status(400).json({ error: 'Agent id is required' });

  try {
    const memories = await prisma.agentMemory.findMany({
      where: { agentId },
      orderBy: { createdAt: 'desc' },
    });
    res.status(200).json(memories);
  } catch (err) {
    console.error('[Agents MEMORY]', err);
    res.status(500).json({ error: 'Failed to fetch agent memory' });
  }
}

export default withAuth(handler);
