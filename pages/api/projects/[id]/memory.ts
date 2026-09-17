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
    const memory = await prisma.projectMemory.findUnique({
      where: { projectId },
    });
    if (!memory) return res.status(404).json({ error: 'No project memory found' });
    res.status(200).json(memory);
  } catch (err) {
    console.error('[Projects MEMORY]', err);
    res.status(500).json({ error: 'Failed to fetch project memory' });
  }
}

export default withAuth(handler);
