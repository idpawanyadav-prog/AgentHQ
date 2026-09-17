import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../../lib/prisma';
import { cancelJob } from '../../../../lib/job-queue';
import { writeTaskMemory, writeHandoffRecord } from '../../../../lib/memory/memory-service';

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

    const run = await prisma.executionRun.findFirst({
      where: { taskId, status: 'running' },
      orderBy: { createdAt: 'desc' },
    });

    if (run) {
      await cancelJob(run.id);
    }

    let checkpointId: string | undefined;
    if (run) {
      const checkpoint = await prisma.executionCheckpoint.create({
        data: { executionRunId: run.id, phase: 'paused' },
      });
      checkpointId = checkpoint.id;
    }

    await writeTaskMemory(prisma, taskId, task.projectId || '', {
      objective: task.title,
      remainingWork: 'Paused',
      nextAction: 'Resume required',
    });

    const handoff = await writeHandoffRecord(prisma, {
      projectId: task.projectId || '',
      taskId: task.id,
      type: 'task_pause',
      summary: 'Task paused by user',
      blockers: 'Paused by user request',
    });

    if (run) {
      await prisma.executionRun.update({
        where: { id: run.id },
        data: { status: 'paused', finishedAt: new Date() },
      });
    }

    await prisma.task.update({
      where: { id: taskId },
      data: { status: 'paused' },
    });

    if (task.agentId) {
      await prisma.agent.update({
        where: { id: task.agentId },
        data: { status: 'idle' },
      });
    }

    res.status(200).json({
      paused: true,
      taskId,
      checkpointId: checkpointId ?? null,
      handoffId: handoff.id,
    });
  } catch (err) {
    console.error('[Tasks PAUSE]', err);
    res.status(500).json({ error: 'Failed to pause task' });
  }
}

export default withAuth(handler);
