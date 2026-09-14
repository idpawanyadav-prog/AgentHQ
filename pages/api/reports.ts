import { withAuth } from '../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';
import { summarizeUsage } from '../../lib/usage';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
  const [tasks, teams, sprints, events] = await Promise.all([
    prisma.task.findMany(), prisma.team.findMany(),
    prisma.sprint.findMany({ include: { tasks: true } }), prisma.activity.findMany(),
  ]);
  res.json({
    totalTasks: tasks.length,
    completed: tasks.filter(t => t.status === 'done').length,
    blocked: tasks.filter(t => t.blocked || t.status === 'blocked').length,
    teams: teams.map(team => ({ id: team.id, name: team.name,
      total: tasks.filter(t => t.teamId === team.id).length,
      completed: tasks.filter(t => t.teamId === team.id && t.status === 'done').length })),
    sprints: sprints.map(s => ({ id: s.id, name: s.name, status: s.status,
      total: s.tasks.length, completed: s.tasks.filter(t => t.status === 'done').length })),
    usage: summarizeUsage(events),
  });
}

export default withAuth(handler);
