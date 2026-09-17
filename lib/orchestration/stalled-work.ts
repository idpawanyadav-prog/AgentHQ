import prisma from '../prisma';

export const STALLED_THRESHOLD_MS = 4 * 60 * 60 * 1000;
export const STALE_HEARTBEAT_MS = 60_000;

export async function getStalledTasks(projectId: string, hoursThreshold?: number, injectedDb?: typeof prisma) {
  const db = injectedDb ?? prisma;
  const thresholdMs = (hoursThreshold ?? 4) * 60 * 60 * 1000;
  const cutoff = new Date(Date.now() - thresholdMs);
  const tasks = await db.task.findMany({
    where: { projectId, status: 'in_progress', updatedAt: { lte: cutoff } },
  });
  const now = Date.now();
  return tasks
    .filter((t) => t.status === 'in_progress' && t.updatedAt && t.updatedAt <= cutoff)
    .map((t) => ({
      id: t.id,
      taskId: t.id,
      title: t.title,
      agentId: t.agentId,
      updatedAt: t.updatedAt,
      minutesSinceUpdate: Math.floor((now - t.updatedAt.getTime()) / 60000),
    }));
}

export async function getStalledExecutions(projectId: string, staleSeconds?: number, injectedDb?: typeof prisma) {
  const db = injectedDb ?? prisma;
  const staleMs = (staleSeconds ?? 60) * 1000;
  const cutoff = new Date(Date.now() - staleMs);
  const executions = await db.executionRun.findMany({
    where: { projectId, heartbeatAt: { lte: cutoff }, status: { not: 'completed' } },
  });
  const now = Date.now();
  return executions
    .filter((e) => e.status !== 'completed' && e.heartbeatAt && e.heartbeatAt <= cutoff)
    .map((e) => ({
      id: e.id,
      executionRunId: e.id,
      taskId: e.taskId,
      agentId: e.agentId,
      heartbeatAt: e.heartbeatAt,
      secondsSinceHeartbeat: e.heartbeatAt
        ? Math.floor((now - e.heartbeatAt.getTime()) / 1000)
        : Math.floor((now - e.updatedAt.getTime()) / 1000),
    }));
}

export async function detectStalledWork(projectId: string, injectedDb?: typeof prisma) {
  const db = injectedDb ?? prisma;
  const [stalledTasks, stalledExecutions] = await Promise.all([
    getStalledTasks(projectId, undefined, db),
    getStalledExecutions(projectId, undefined, db),
  ]);
  return { stalledTasks, stalledExecutions };
}