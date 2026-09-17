import prisma from '../prisma';

export async function createExecutionCheckpoint(data: {
  executionRunId: string;
  phase: string;
  gitCommit?: string | null;
  taskStatus?: string | null;
  agentStatus?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  return prisma.executionCheckpoint.create({
    data: {
      executionRunId: data.executionRunId,
      phase: data.phase,
      gitCommit: data.gitCommit ?? null,
      taskStatus: data.taskStatus ?? null,
      agentStatus: data.agentStatus ?? null,
      metadata: data.metadata ? JSON.stringify(data.metadata) : null,
    },
  });
}

export async function getCheckpointsForRun(executionRunId: string) {
  return prisma.executionCheckpoint.findMany({
    where: { executionRunId },
    orderBy: { createdAt: 'desc' },
  });
}

export async function getLatestCheckpoint(executionRunId: string) {
  return prisma.executionCheckpoint.findFirst({
    where: { executionRunId },
    orderBy: { createdAt: 'desc' },
  });
}
