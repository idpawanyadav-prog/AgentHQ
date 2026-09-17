import prisma from '../prisma';

export async function planSprint(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({
    where: { id: sprintId },
    include: { project: { include: { team: { include: { members: { include: { agents: { include: { tasks: true } } } } } } } } },
  });
  if (!sprint) throw new Error('Sprint not found');
  const candidateTasks = await prisma.task.findMany({
    where: { projectId: sprint.projectId, status: { in: ['backlog', 'ready'] } },
  });
  const readyTasks = candidateTasks.filter(t => isDefinitionOfReady(t));
  const totalPoints = readyTasks.reduce((sum, t) => sum + (t.storyPoints || 0), 0);
  const teamCapacity = sprint.project.team.members
    .flatMap(m => m.agents)
    .reduce((sum, agent) => {
      const activePoints = agent.tasks.filter(t => ['ready', 'in_progress', 'review', 'testing'].includes(t.status)).reduce((s, t) => s + (t.storyPoints || 0), 0);
      return sum + Math.max(0, 13 - activePoints);
    }, 0);
  const warnings: string[] = [];
  if (totalPoints > teamCapacity) warnings.push(`Planned ${totalPoints} points exceeds team capacity of ${teamCapacity}`);
  return { sprint, readyTasks, totalPoints, teamCapacity, warnings };
}

function isDefinitionOfReady(task: any): boolean {
  if (!task.title?.trim()) return false;
  if (!task.description?.trim()) return false;
  if (!task.acceptanceCriteria || task.acceptanceCriteria === '[]') return false;
  return true;
}

export async function startSprint(sprintId: string) {
  await prisma.sprint.update({ where: { id: sprintId }, data: { status: 'active', startDate: new Date() } });
  return { started: true, sprintId };
}

export async function completeSprint(sprintId: string) {
  const sprint = await prisma.sprint.findUnique({ where: { id: sprintId }, include: { tasks: true } });
  if (!sprint) throw new Error('Sprint not found');
  const completed = sprint.tasks.filter(t => t.status === 'done').map(t => t.title).join(', ');
  const incomplete = sprint.tasks.filter(t => t.status !== 'done').map(t => t.title).join(', ');
  await prisma.sprintSummary.upsert({
    where: { sprintId },
    create: { sprintId, projectId: sprint.projectId, goal: sprint.goal, completed, incomplete, blockers: '', decisions: '', lessons: '' },
    update: { completed, incomplete, blockers: '', decisions: '', lessons: '' },
  });
  await prisma.sprint.update({ where: { id: sprintId }, data: { status: 'completed', endDate: new Date() } });
  return { completed: true, sprintId, completedCount: sprint.tasks.filter(t => t.status === 'done').length };
}
