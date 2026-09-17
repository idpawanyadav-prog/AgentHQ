import { recoverInterruptedExecutions } from './recovery-service';
import { calculateReadyTasks, getReadyTasks } from './task-dependencies';
import { getAvailableAgents, matchTasksToAgents } from './assignment-planner';
import { detectStalledWork } from './stalled-work';
import { computeDeliveryState, updateProjectDeliveryState } from './delivery-state';
import { writeAgentMemory } from '../memory/memory-service';
import prisma from '../prisma';

export async function queueAssignments(
  projectId: string,
  assignments: Array<{ taskId: string; agentId: string; score: number; reason?: string }>,
  injectedDb?: typeof prisma
): Promise<void> {
  const db = injectedDb ?? prisma;
  for (const assignment of assignments) {
    await db.$transaction(async (tx) => {
      const task = await tx.task.findUnique({ where: { id: assignment.taskId } });
      if (!task) return;

      await tx.task.update({
        where: { id: assignment.taskId },
        data: { status: 'in_progress', agentId: assignment.agentId },
      });

      await tx.agent.update({ where: { id: assignment.agentId }, data: { status: 'working' } });

      await tx.job.create({
        data: {
          kind: 'agent_run',
          agentId: assignment.agentId,
          taskId: assignment.taskId,
          teamId: projectId,
          payload: JSON.stringify({
            taskId: assignment.taskId,
            agentId: assignment.agentId,
            score: assignment.score,
            reason: assignment.reason,
          }),
          status: 'queued',
        },
      });

      await tx.activity.create({
        data: {
          type: 'task_assigned',
          description: `Task assigned to agent ${assignment.agentId}`,
          meta: JSON.stringify({
            taskId: assignment.taskId,
            agentId: assignment.agentId,
            score: assignment.score,
          }),
          teamId: projectId,
          taskId: assignment.taskId,
        },
      });
    });
  }
}

export async function runProjectOrchestrationCycle(
  projectId: string,
  injectedDb?: typeof prisma
) {
  try {
    const recovery = await recoverInterruptedExecutions(projectId, injectedDb);
    await calculateReadyTasks(projectId, injectedDb);
    const readyTasks = await getReadyTasks(projectId, injectedDb);
    const availableAgents = await getAvailableAgents(projectId, injectedDb);
    const assignments = await matchTasksToAgents(readyTasks, availableAgents, projectId);
    await queueAssignments(projectId, assignments, injectedDb);
    const stalled = await detectStalledWork(projectId);
    await updateProjectDeliveryState(projectId, injectedDb);
    return {
      recovered: recovery.recovered.length,
      queued: assignments.length,
      ready: readyTasks.length,
      blocked: 0,
      assignments: assignments.length,
      readyTasks: readyTasks.length,
      stalled: {
        stalledTasks: stalled.stalledTasks.length,
        stalledExecutions: stalled.stalledExecutions.length,
      },
    };
  } catch (error) {
    console.error(`Orchestration cycle failed for project ${projectId}:`, error);
    return {
      recovered: 0,
      queued: 0,
      ready: 0,
      blocked: 0,
      assignments: 0,
      readyTasks: 0,
      stalled: { stalledTasks: 0, stalledExecutions: 0 },
      error: String(error),
    };
  }
}

export async function runOrchestrationCycle(
  projectId: string,
  injectedDb?: typeof prisma
) {
  return runProjectOrchestrationCycle(projectId, injectedDb);
}

export async function triggerOrchestration(trigger: string, projectId?: string, injectedDb?: typeof prisma) {
  const db = injectedDb ?? prisma;
  const projects = projectId
    ? [projectId]
    : await db.project.findMany().then((p) => p.map((p) => p.id));
  const results: Record<string, { queued: number; ready: number }> = {};
  for (const pid of projects) {
    try {
      const r = await runProjectOrchestrationCycle(pid, injectedDb);
      results[pid] = { queued: r.queued, ready: r.ready };
    } catch {
      results[pid] = { queued: 0, ready: 0 };
    }
  }
  return results;
}

export function getOrchestrationTriggerConditions(): string[] {
  return ['task_completion', 'task_failure', 'agent_idle', 'sprint_start', 'task_resume', 'user_continue'];
}

export { getReadyTasks, calculateReadyTasks, getAvailableAgents, detectStalledWork, updateProjectDeliveryState, recoverInterruptedExecutions, matchTasksToAgents };
