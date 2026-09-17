import prisma from '../prisma';

const READY_TRANSITIONS = new Set(['backlog', 'paused']);

function parseDeps(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((x) => String(x)) : [];
  } catch {
    return [];
  }
}

export async function getReadyTasks(projectId: string, injectedDb?: typeof prisma) {
  const db = injectedDb ?? prisma;
  const tasks = await db.task.findMany({
    where: { projectId, status: { in: ['backlog', 'paused'] } },
  });
  const ready: any[] = [];
  for (const task of tasks) {
    if (!task.title || !task.description || !task.acceptanceCriteria) continue;
    const deps = parseDeps(task.dependencies);
    if (deps.length === 0) { ready.push(task); continue; }
    const depTasks = await db.task.findMany({
      where: { id: { in: deps }, status: { not: 'done' } },
    });
    if (depTasks.length === 0) ready.push(task);
  }
  return ready;
}

export async function getDependencyChain(taskId: string): Promise<string[]> {
  const task = await prisma.task.findUnique({ where: { id: taskId } });
  if (!task) return [];
  const deps = parseDeps(task.dependencies);
  const chain: string[] = [];
  const visited = new Set<string>();
  for (const depId of deps) {
    if (visited.has(depId)) continue;
    visited.add(depId);
    chain.push(...(await getDependencyChain(depId)));
    chain.push(depId);
  }
  return chain;
}

export async function detectDependencyCycles(projectId: string): Promise<{ hasCycle: boolean; cycleMembers: string[] }> {
  const tasks = await prisma.task.findMany({ where: { projectId } });
  const deps: Record<string, string[]> = {};
  for (const task of tasks) {
    deps[task.id] = parseDeps(task.dependencies);
  }
  const visited = new Set<string>();
  const inStack = new Set<string>();
  const cycleNodes = new Set<string>();

  function dfs(id: string) {
    if (inStack.has(id)) { cycleNodes.add(id); return; }
    if (visited.has(id)) return;
    visited.add(id);
    inStack.add(id);
    for (const dep of deps[id] || []) dfs(dep);
    inStack.delete(id);
  }

  for (const task of tasks) dfs(task.id);

  const cycleMembers = Array.from(cycleNodes);

  if (cycleMembers.length > 0) {
    for (const nodeId of cycleMembers) {
      await prisma.projectIssue.create({
        data: {
          projectId,
          severity: 'high',
          title: 'Dependency cycle detected',
          description: `Task ${nodeId} is part of a dependency cycle.`,
          source: 'task-dependencies',
        },
      });
    }
  }

  return { hasCycle: cycleMembers.length > 0, cycleMembers };
}

export async function calculateReadyTasks(projectId: string, injectedDb?: typeof prisma): Promise<string[]> {
  const db = injectedDb ?? prisma;
  const tasks = await db.task.findMany({ where: { projectId } });
  const affected: string[] = [];
  for (const task of tasks) {
    if (!READY_TRANSITIONS.has(task.status)) continue;
    const deps = parseDeps(task.dependencies);
    if (deps.length === 0) {
      if (task.status === 'paused') continue;
      await db.task.update({ where: { id: task.id }, data: { status: 'ready' } });
      affected.push(task.id);
      continue;
    }
    const depTasks = await prisma.task.findMany({ where: { id: { in: deps } } });
    const doneDeps = depTasks.filter((d) => d.status === 'done');
    if (doneDeps.length === deps.length) {
      await db.task.update({ where: { id: task.id }, data: { status: 'ready' } });
      affected.push(task.id);
    } else if (doneDeps.length === 0 && depTasks.length > 0) {
      if (task.status !== 'blocked') {
        await prisma.task.update({
          where: { id: task.id },
          data: { status: 'blocked', blocked: true, blockedReason: 'Dependencies not satisfied' },
        });
        affected.push(task.id);
      }
    }
  }
  return affected;
}

export function isDefinitionOfReady(task: {
  title?: string | null;
  description?: string | null;
  acceptanceCriteria?: string | null;
  agentId?: string | null;
}): boolean {
  if (!task.title?.trim()) return false;
  if (!task.description?.trim()) return false;
  if (!task.acceptanceCriteria || task.acceptanceCriteria === '[]') return false;
  return true;
}
