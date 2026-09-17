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
    const memory = await prisma.taskMemory.findUnique({
      where: { taskId },
    });
    if (!memory) return res.status(404).json({ error: 'No task memory found' });
    res.status(200).json(memory);
  } catch (err) {
    console.error('[Tasks MEMORY]', err);
    res.status(500).json({ error: 'Failed to fetch task memory' });
  }
}

export default withAuth(handler);
