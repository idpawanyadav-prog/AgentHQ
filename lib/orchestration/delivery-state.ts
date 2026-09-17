import prisma from '../prisma';

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

export async function computeDeliveryState(projectId: string, injectedDb?: typeof prisma): Promise<ProjectDeliveryState> {
  const db = injectedDb ?? prisma;
  const project = await db.project.findUnique({
    where: { id: projectId },
    include: {
      tasks: true,
      team: {
        include: {
          members: {
            include: { agents: true },
          },
        },
      },
      sprints: { where: { status: 'active' }, orderBy: { startDate: 'desc' }, take: 1 },
    },
  });

  if (!project) {
    return { phase: 'planning', readyTasks: 0, activeTasks: 0, blockedTasks: 0, completedTasks: 0, workingAgents: 0, idleAgents: 0 };
  }

  const tasks = project.tasks || [];
  const readyTasks = tasks.filter((t: any) => t.status === 'ready').length;
  const activeTasks = tasks.filter((t: any) => ['in_progress', 'review', 'testing'].includes(t.status)).length;
  const blockedTasks = tasks.filter((t: any) => t.blocked || t.status === 'blocked').length;
  const completedTasks = tasks.filter((t: any) => t.status === 'done').length;

  const team = project.team || { members: [] };
  const agents = team.members.flatMap((m: any) => m.agents || []);
  const workingAgents = agents.filter((a: any) => a.status === 'working').length;
  const idleAgents = agents.filter((a: any) => a.status === 'idle').length;

  const activeSprint = project.sprints?.[0];

  let phase: ProjectDeliveryState['phase'] = 'planning';
  if (blockedTasks > 0 && workingAgents === 0) phase = 'blocked';
  else if (completedTasks === tasks.length && tasks.length > 0) phase = 'completed';
  else if (activeTasks > 0) phase = 'building';
  else if (readyTasks > 0) phase = 'planning';

  return {
    phase,
    activeSprintId: activeSprint?.id,
    currentGoal: activeSprint?.goal || undefined,
    readyTasks,
    activeTasks,
    blockedTasks,
    completedTasks,
    workingAgents,
    idleAgents,
  };
}

export async function updateProjectDeliveryState(projectId: string, injectedDb?: typeof prisma): Promise<ProjectDeliveryState> {
  const db = injectedDb ?? prisma;
  const state = await computeDeliveryState(projectId, db);
  const summary = JSON.stringify({
    readyTasks: state.readyTasks,
    activeTasks: state.activeTasks,
    blockedTasks: state.blockedTasks,
    completedTasks: state.completedTasks,
    workingAgents: state.workingAgents,
    idleAgents: state.idleAgents,
  });
  try {
    await db.projectExecutionState.upsert({
      where: { projectId },
      update: { phase: state.phase, summary },
      create: { projectId, phase: state.phase, status: 'active', summary },
    });
  } catch {
    // projectExecutionState may not exist yet in dev
  }
  return state;
}
