import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { writeTaskMemory } from '../../../../lib/memory/memory-service';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const taskId = typeof req.query.id === 'string' ? req.query.id : null;
  if (!taskId) return res.status(400).json({ error: 'Task id is required' });

  try {
    const task = await prisma.task.findUnique({ where: { id: taskId } });
    if (!task) return res.status(404).json({ error: 'Task not found' });

    const agentId = typeof req.body?.agentId === 'string' && req.body.agentId.trim()
      ? req.body.agentId.trim()
      : null;

    if (agentId) {
      const agent = await prisma.agent.findUnique({ where: { id: agentId } });
      if (!agent) return res.status(404).json({ error: 'Agent not found' });
    }

    const [projectMemory, taskMemory, checkpoints, handoffs] = await Promise.all([
      task.projectId
        ? prisma.projectMemory.findUnique({ where: { projectId: task.projectId } })
        : Promise.resolve(null),
      prisma.taskMemory.findUnique({ where: { taskId } }),
      prisma.executionCheckpoint.findMany({
        where: { executionRun: { taskId } },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
      prisma.handoffRecord.findMany({
        where: { taskId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    ]);

    const previousCheckpoint = checkpoints.length > 0 ? checkpoints[0] : null;
    const previousHandoff = handoffs.length > 0 ? handoffs[0] : null;

    const newRun = await prisma.executionRun.create({
      data: {
        projectId: task.projectId || '',
        taskId: task.id,
        agentId: agentId,
        engine: 'api-chat',
        status: 'queued',
      },
    });

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'in_progress', ...(agentId ? { agentId } : {}) },
    });

    const handoff = await prisma.handoffRecord.create({
      data: {
        projectId: task.projectId || '',
        taskId: task.id,
        type: 'task_resume',
        summary: 'Task resumed',
        toAgentId: agentId,
      },
    });

    await writeTaskMemory(prisma, taskId, task.projectId || '', {
      lastAgentId: agentId,
      lastExecutionId: newRun.id,
    });

    res.status(200).json({
      resumed: true,
      taskId,
      executionRunId: newRun.id,
      handoffId: handoff.id,
      context: {
        projectMemory,
        taskMemory,
        previousCheckpoint,
        previousHandoff,
        agentId,
      },
    });
  } catch (err) {
    console.error('[Tasks RESUME]', err);
    res.status(500).json({ error: 'Failed to resume task' });
  }
}

export default withAuth(handler);