import prisma from '../prisma';

const ROLE_SCORE = 40;
const ROLE_GROUP_SCORE = 25;
const REQUIRED_SKILL_SCORE = 15;
const PREFERRED_SKILL_SCORE = 5;
const IDLE_SCORE = 15;
const SAME_PROJECT_SCORE = 10;
const TASK_MEMORY_SCORE = 5;
const WORKING_PENALTY = -40;
const OVERLOADED_PENALTY = -60;
const BLOCKED_PENALTY = -30;
const MAX_ACTIVE_TASKS = 4;

function inferRoleFromTask(task: { title?: string; description?: string }): string {
  const text = `${task.title || ''} ${task.description || ''}`.toLowerCase();
  if (/frontend|ui|css|react|page/.test(text)) return 'Frontend Developer';
  if (/backend|api|server|database|auth/.test(text)) return 'Backend Developer';
  if (/test|qa/.test(text)) return 'QA Engineer';
  return 'Full-stack Developer';
}

function getRoleGroup(taskRole: string): string[] {
  const map: Record<string, string[]> = {
    'Backend Developer': ['Backend Developer', 'Full-stack'],
    'Frontend Developer': ['Frontend Developer', 'Full-stack'],
    'QA': ['QA', 'Tester', 'Reviewer'],
    'Full-stack': ['Full-stack', 'Backend Developer', 'Frontend Developer'],
    'Team Lead': ['Team Lead', 'Full-stack'],
  };
  return map[taskRole] || [];
}

export function scoreAgentForTask(
  agent: { id: string; name: string; status: string; tasks: any[]; config?: string | null; memberId: string },
  task: { id: string; requiredRole?: string; title?: string; description?: string; storyPoints?: number },
  projectId?: string
): { score: number; reason: string } {
  let score = 0;
  const reasons: string[] = [];
  const taskRole = task.requiredRole || inferRoleFromTask(task);

  if (agent.name.toLowerCase().includes(taskRole.toLowerCase()) || taskRole.toLowerCase().includes(agent.name.toLowerCase())) {
    score += ROLE_SCORE;
    reasons.push('Exact role match (+40)');
  }

  if (getRoleGroup(taskRole).some((r) => agent.name.toLowerCase().includes(r.toLowerCase()))) {
    score += ROLE_GROUP_SCORE;
    reasons.push('RoleGroup match (+25)');
  }

  const agentSkills: string[] = [];
  try {
    const config = agent.config ? JSON.parse(agent.config) : {};
    if (Array.isArray(config.skills)) agentSkills.push(...config.skills.map((s: string) => s.toLowerCase()));
  } catch {}

  const requiredSkills = (task.description || '').toLowerCase().split(/\s+/).filter((w) => w.length > 3);
  for (const skill of requiredSkills) {
    if (agentSkills.some((s) => s.includes(skill))) {
      score += REQUIRED_SKILL_SCORE;
      reasons.push(`Required skill: ${skill} (+15)`);
    }
  }

  if (agent.status === 'idle') {
    score += IDLE_SCORE;
    reasons.push('Agent is idle (+15)');
  }

  if (projectId) {
    score += SAME_PROJECT_SCORE;
    reasons.push('Same project (+10)');
  }

  if (agentSkills.length > 0) {
    score += TASK_MEMORY_SCORE;
    reasons.push('Has skills (+5)');
  }

  const activeCount = agent.tasks.filter((t) =>
    ['ready', 'in_progress', 'review', 'testing'].includes(t.status)
  ).length;

  if (agent.status === 'working') {
    score += WORKING_PENALTY;
    reasons.push('Agent is working (-40)');
  }

  if (activeCount >= MAX_ACTIVE_TASKS) {
    score += OVERLOADED_PENALTY;
    reasons.push('Agent overloaded (-60)');
  }

  return { score, reason: reasons.join(', ') || 'No significant factors' };
}

export function findBestAgentForTask(task: any, agents: any[], projectId?: string): any | null {
  if (!agents || agents.length === 0) return null;
  const scored = agents.map(a => ({ agent: a, ...scoreAgentForTask(a, task, projectId) }));
  scored.sort((a, b) => b.score - a.score);
  const best = scored[0];
  return best && best.score > 0 ? best.agent : null;
}

export async function assignTasksToAgents(readyTasks: any[], availableAgents: any[], projectId?: string) {
  const assignments: Array<{ taskId: string; agentId: string }> = [];
  const usedAgents = new Set<string>();
  for (const task of readyTasks) {
    const candidates = availableAgents.filter(a => !usedAgents.has(a.id));
    if (candidates.length === 0) break;
    const best = findBestAgentForTask(task, candidates, projectId);
    if (best) {
      assignments.push({ taskId: task.id, agentId: best.id });
      usedAgents.add(best.id);
    }
  }
  return assignments;
}

export async function getAvailableAgents(projectId: string, injectedDb?: typeof prisma) {
  const db = injectedDb ?? prisma;
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: { team: { include: { members: { include: { agents: { include: { tasks: true } } } } } } },
  });
  if (!project) return [];
  return project.team.members.flatMap((m: any) =>
    m.agents
      .filter((a: any) => a.status === 'idle')
      .filter((a: any) => !a.tasks.some((t: any) =>
        ['ready', 'in_progress', 'review', 'testing'].includes(t.status)
      ))
      .map((a: any) => ({ ...a, role: m.role, memberId: m.id }))
  );
}

export async function matchTasksToAgents(
  readyTasks: any[],
  availableAgents: any[],
  projectId?: string
) {
  const assignments: Array<{ taskId: string; agentId: string; score: number; reason: string }> = [];
  const usedAgents = new Set<string>();

  for (const task of readyTasks) {
    const candidates = availableAgents.filter((a: any) => !usedAgents.has(a.id));
    if (candidates.length === 0) break;

    const scored = candidates.map((a: any) => ({ agent: a, ...scoreAgentForTask(a, task, projectId) }));
    scored.sort((a: any, b: any) => b.score - a.score);
    const best = scored[0];

    if (best && best.score > 0) {
      assignments.push({
        taskId: task.id,
        agentId: best.agent.id,
        score: best.score,
        reason: best.reason,
      });
      usedAgents.add(best.agent.id);
    }
  }

  return assignments;
}

export function suggestTaskSplit(oversizedTask: { id: string; title: string; description?: string | null; storyPoints: number; acceptanceCriteria?: string | null }) {
  if (oversizedTask.storyPoints < 8) return { subTasks: [] };
  const totalPoints = oversizedTask.storyPoints;
  const sub1Points = Math.ceil(totalPoints / 2);
  const sub2Points = totalPoints - sub1Points;
  return {
    subTasks: [
      {
        title: `${oversizedTask.title} — Part 1`,
        description: oversizedTask.description ?? '',
        storyPoints: sub1Points,
        acceptanceCriteria: oversizedTask.acceptanceCriteria ?? '',
        dependencies: [],
      },
      {
        title: `${oversizedTask.title} — Part 2`,
        description: oversizedTask.description ?? '',
        storyPoints: sub2Points,
        acceptanceCriteria: oversizedTask.acceptanceCriteria ?? '',
        dependencies: [oversizedTask.id],
      },
    ],
  };
}

export async function queueAssignments(assignments: Array<{ taskId: string; agentId: string; score?: number }>) {
  for (const a of assignments) {
    await prisma.task.update({ where: { id: a.taskId }, data: { status: 'in_progress', agentId: a.agentId } });
    await prisma.agent.update({ where: { id: a.agentId }, data: { status: 'working' } });
    await prisma.job.create({
      data: {
        kind: 'agent_run',
        agentId: a.agentId,
        taskId: a.taskId,
        payload: JSON.stringify({ agentId: a.agentId, taskId: a.taskId, teamId: '' }),
      },
    });
  }
}
