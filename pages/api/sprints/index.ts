import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 if (req.method === 'GET') {
 const { projectId } = req.query;
 const where: Record<string, string> = {};
 if (projectId && projectId !== 'undefined') where.projectId = projectId as string;

 const sprints = await prisma.sprint.findMany({
 where: Object.keys(where).length > 0 ? where : undefined,
 include: {
 project: true,
 tasks: { orderBy: { createdAt: 'desc' } },
 _count: { select: { tasks: true } },
 },
 orderBy: { order: 'asc' },
 });
 res.status(200).json(sprints);
 } else if (req.method === 'POST') {
 const { name, goal, projectId, status, order } = req.body;
 if (typeof name !== 'string' || !name.trim() || typeof projectId !== 'string' || !projectId) return res.status(400).json({ error: 'name and projectId are required' });
 if (!await prisma.project.findUnique({where:{id:projectId}})) return res.status(400).json({error:'Project not found'});
 const sprint = await prisma.sprint.create({
 data: {
 name,
 goal: goal || null,
 projectId,
 status: status || 'planned',
 order: order ?? 0,
 },
 include: { project: true, tasks: true },
 });
 res.status(201).json(sprint);
 } else {
 res.setHeader('Allow', ['GET', 'POST']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
