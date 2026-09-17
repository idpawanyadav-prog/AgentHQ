import prisma from '../prisma';
import { writeAgentMemory } from '../memory/memory-service';

export async function runQA(
  taskId: string,
  injectedDb?: typeof prisma
): Promise<{
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
}> {
  const db = injectedDb ?? prisma;
  const task = await db.task.findUnique({ where: { id: taskId } });
  if (!task) {
    return { passed: false, checks: [{ name: 'task_exists', passed: false, detail: `Task ${taskId} not found` }] };
  }

  const checks: Array<{ name: string; passed: boolean; detail: string }> = [];
  const isReviewing = task.status === 'review';
  checks.push({ name: 'task_in_review', passed: isReviewing, detail: isReviewing ? `Task is in ${task.status}` : `Task status is ${task.status}` });

  const hasAcceptance = !!task.acceptanceCriteria && task.acceptanceCriteria.trim().length > 0;
  checks.push({
    name: 'acceptance_criteria',
    passed: hasAcceptance,
    detail: hasAcceptance ? 'Acceptance criteria defined' : 'No acceptance criteria',
  });

  const passed = checks.every((c) => c.passed);
  return { passed, checks };
}

export async function recordQAResult(
  taskId: string,
  result: { passed: boolean; checks: Array<{ name: string; passed: boolean; detail: string }> },
  agentId?: string,
  injectedDb?: typeof prisma
) {
  const db = injectedDb ?? prisma;
  const task = await db.task.findUnique({ where: { id: taskId } });
  const projectId = task?.projectId ?? '';

  if (result.passed) {
    await db.task.update({ where: { id: taskId }, data: { status: 'done' } });
  }

  await db.activity.create({
    data: {
      type: 'qa_result',
      description: `QA result for task ${taskId}: ${result.passed ? 'passed' : 'failed'}`,
      meta: JSON.stringify({ taskId, result, agentId }),
      teamId: projectId,
      taskId,
    },
  });

  return result;
}

export async function getPendingQA(projectId: string, injectedDb?: typeof prisma) {
  const db = injectedDb ?? prisma;
  return db.task.findMany({
    where: { projectId, status: 'review' },
  });
}
