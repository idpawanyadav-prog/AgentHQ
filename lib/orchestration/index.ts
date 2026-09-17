export type AgentScore = {
  score: number;
  reason: string;
};

export type AssignmentMatch = {
  taskId: string;
  agentId: string;
  score: number;
  reason: string;
};

export type DependencyResult = {
  chain: string[];
  hasCycle: boolean;
  cycleMembers: string[];
};

export type StalledResult = {
  stalledTasks: Array<{ id: string; title: string; updatedAt: Date }>;
  stalledExecutions: Array<{ id: string; taskId?: string; agentId?: string }>;
};

export type ProjectDeliveryState = {
  phase: 'discovery' | 'planning' | 'building' | 'reviewing' | 'testing' | 'releasing' | 'blocked' | 'completed';
  activeSprintId?: string;
  currentGoal?: string;
  readyTasks: number;
  activeTasks: number;
  blockedTasks: number;
  completedTasks: number;
  workingAgents: number;
  idleAgents: number;
};

export type TaskReviewRecord = {
  id: string;
  projectId: string;
  taskId: string;
  executionRunId?: string;
  reviewerAgentId?: string;
  status: 'pending' | 'approved' | 'changes_requested';
  summary?: string;
  findings?: string;
  repairCycles: number;
  createdAt: Date;
  completedAt?: Date;
};

export type QAResult = {
  passed: boolean;
  checks: Array<{ name: string; passed: boolean; detail: string }>;
};

export function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

export function inferRoleFromTask(task: { type?: string; title?: string | null; description?: string | null }): string {
  const text = `${task.title || ''} ${task.description || ''} ${task.type || ''}`.toLowerCase();
  if (/backend|api|payment|billing|auth|database|webhook|server/.test(text)) return 'Backend Developer';
  if (/frontend|ui|screen|react|button|page|css|style|component/.test(text)) return 'Frontend Developer';
  if (/test|qa|regression|quality|testing/.test(text)) return 'QA Engineer';
  if (/security|permission|compliance|audit/.test(text)) return 'Security Reviewer';
  if (/requirement|scope|business|analysis/.test(text)) return 'Business Analyst';
  if (/bug|fix|hotfix/.test(text)) return 'Full-stack Developer';
  return 'Full-stack Developer';
}

export function parseDependencies(deps: string | null | undefined): string[] {
  if (!deps) return [];
  try { return JSON.parse(deps); } catch { return []; }
}

export function getRoleGroupMatch(agent: { agentRoleAssignments?: Array<{ roleGroup?: { name?: string } }> }, requiredRole: string): boolean {
  if (!agent.agentRoleAssignments) return false;
  return agent.agentRoleAssignments.some((ara) => {
    const name = ara.roleGroup?.name || '';
    return name.toLowerCase().includes(requiredRole.toLowerCase());
  });
}

export function getAgentSkills(agent: { config?: string | null }): { required: string[]; preferred: string[] } {
  if (!agent.config) return { required: [], preferred: [] };
  try {
    const parsed = JSON.parse(agent.config);
    return {
      required: parsed.skills?.required || [],
      preferred: parsed.skills?.preferred || [],
    };
  } catch {
    return { required: [], preferred: [] };
  }
}

export function getAgentActiveTaskCount(agent: { tasks?: Array<{ status?: string }> }): number {
  if (!agent.tasks) return 0;
  return agent.tasks.filter((t) => !['done', 'backlog', 'blocked', 'paused'].includes(t.status || '')).length;
}

export function isAgentAvailable(agent: { status?: string; tasks?: Array<{ status?: string }> }): boolean {
  if (agent.status !== 'idle') return false;
  return getAgentActiveTaskCount(agent) < 4;
}
