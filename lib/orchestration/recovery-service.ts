import prisma from '../prisma';
import { writeAgentMemory, writeTaskMemory } from '../memory/memory-service';
import { recordProposal } from '../proposal-store';

export async function detectStaleRuns(projectId?: string, staleSeconds?: number, injectedDb?: typeof prisma) {
  const db = injectedDb ?? prisma;
  const staleMs = (staleSeconds ?? 60) * 1000;
  const cutoff = new Date(Date.now() - staleMs);
  const where: any = { status: 'running', heartbeatAt: { lt: cutoff } };
  if (projectId) where.projectId = projectId;

  const stale = await db.executionRun.findMany({ where });
  const now = Date.now();
  return stale.map((r) => ({
    id: r.id,
    executionRunId: r.id,
    projectId: r.projectId,
    taskId: r.taskId,
    agentId: r.agentId,
    heartbeatAt: r.heartbeatAt,
    secondsSinceHeartbeat: r.heartbeatAt
      ? Math.floor((now - r.heartbeatAt.getTime()) / 1000)
      : Math.floor((now - r.updatedAt.getTime()) / 1000),
  }));
}

export async function recoverInterruptedExecutions(projectId?: string, injectedDb?: typeof prisma): Promise<{ recovered: string[] }> {
  const db = injectedDb ?? prisma;
  const threshold = new Date(Date.now() - 60_000);
  const where: any = { status: 'running', OR: [{ heartbeatAt: { lt: threshold } }, { heartbeatAt: null }] };
  if (projectId) where.projectId = projectId;
  const stale = await db.executionRun.findMany({ where });
  const recoveredIds: string[] = [];

  if (stale.length === 0) return { recovered: recoveredIds };

  for (const run of stale) {
    await db.$transaction(async (tx) => {
      await tx.executionRun.update({
        where: { id: run.id },
        data: { status: 'interrupted', finishedAt: run.finishedAt ?? new Date() },
      });

      await tx.executionCheckpoint.create({
        data: {
          executionRunId: run.id,
          phase: 'recovery',
          taskStatus: run.taskId ? 'paused' : null,
          agentStatus: run.agentId ? 'idle' : null,
          metadata: JSON.stringify({
            reason: 'interrupted_recovery',
            previousStatus: run.status,
            recoveredAt: new Date().toISOString(),
          }),
        },
      });

      if (run.taskId) {
        await tx.task.update({
          where: { id: run.taskId },
          data: { status: 'paused', blockedReason: 'interrupted_recovery' },
        });
      }

      if (run.agentId) {
        await tx.agent.update({ where: { id: run.agentId }, data: { status: 'idle' } });
      }

      recoveredIds.push(run.id);
    });
  }

  return { recovered: recoveredIds };
}

export async function recoverProject(projectId: string, injectedDb?: typeof prisma): Promise<{
  recovered: string[];
  readyTasks: number;
  activeTasks: number;
}> {
  const { calculateReadyTasks } = await import('./task-dependencies');

  const result = await recoverInterruptedExecutions(projectId, injectedDb);
  await calculateReadyTasks(projectId, injectedDb);

  const db = injectedDb ?? prisma;
  const [readyTasks, activeTasks] = await Promise.all([
    db.task.count({ where: { projectId, status: 'ready' } }),
    db.task.count({ where: { projectId, status: 'in_progress' } }),
  ]);

  return { recovered: result.recovered, readyTasks, activeTasks };
}

export async function resumeTask(taskId: string, injectedDb?: typeof prisma) {
  const db = injectedDb ?? prisma;
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) throw new Error(`Task not found: ${taskId}`);
  if (task.status !== 'paused') {
    throw new Error(`Cannot resume task ${taskId}: status is '${task.status}', expected 'paused'`);
  }

  const newRun = await db.executionRun.create({
    data: {
      projectId: task.projectId ?? '',
      taskId,
      agentId: task.agentId ?? null,
      engine: 'claude-code',
      status: 'queued',
    },
  });

  await db.task.update({
    where: { id: taskId },
    data: {
      status: 'ready',
      blocked: false,
      blockedReason: null,
      agentId: task.agentId,
    },
  });

  await db.job.create({
    data: {
      kind: 'execution_run',
      agentId: task.agentId ?? '',
      taskId,
      teamId: task.teamId,
      payload: JSON.stringify({
        executionRunId: newRun.id,
        taskId,
        agentId: task.agentId,
      }),
    },
  });

  return newRun;
}
