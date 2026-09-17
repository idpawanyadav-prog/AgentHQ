import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { writeHandoffRecord } from '../../../../lib/memory/memory-service';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const taskId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!taskId) return res.status(400).json({ error: 'Task id is required' });

  try {
    const task = await prisma.task.findUnique({
      where: { id: taskId },
      include: { project: true },
    });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const newAgentId = typeof req.body?.newAgentId === 'string'
      ? req.body.newAgentId.trim()
      : null;
    if (!newAgentId) return res.status(400).json({ error: 'newAgentId is required' });

    const newAgent = await prisma.agent.findUnique({ where: { id: newAgentId } });
    if (!newAgent) return res.status(404).json({ error: `Agent ${newAgentId} not found` });

    if (newAgent.status !== 'idle') {
      return res.status(409).json({ error: `Agent is not available (current status: ${newAgent.status})` });
    }

    const handoff = await writeHandoffRecord(prisma, {
      projectId: task.projectId || '',
      taskId: task.id,
      type: 'agent_reassignment',
      summary: 'Agent reassigned',
      toAgentId: newAgentId,
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { agentId: newAgentId },
    });

    res.status(200).json({
      reassigned: true,
      taskId,
      newAgentId,
      handoffId: handoff.id,
    });
  } catch (err) {
    console.error('[Tasks REASSIGN]', err);
    res.status(500).json({ error: 'Failed to reassign task' });
  }
}

export default withAuth(handler);
