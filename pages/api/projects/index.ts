import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 if (req.method === 'GET') {
 const projects = await prisma.project.findMany({
 include: {
 team: true,
 milestones: { orderBy: { order: 'asc' } },
 sprints: { orderBy: { order: 'asc' } },
 _count: { select: { tasks: true } },
 },
 orderBy: { createdAt: 'desc' },
 });
 res.status(200).json(projects);
 } else if (req.method === 'POST') {
 const { name, description, teamId, repoUrl } = req.body;
 if (!name || !teamId) return res.status(400).json({ error: 'name and teamId are required' });
 const project = await prisma.project.create({
 data: { name, description: description || null, teamId, repoUrl: repoUrl || null },
 include: { team: true, milestones: true, sprints: true },
 });
 res.status(201).json(project);
 } else {
 res.setHeader('Allow', ['GET', 'POST']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
