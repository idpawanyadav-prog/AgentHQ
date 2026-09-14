import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { id } = req.query;
 if (req.method === 'GET') {
 try {
 const project = await prisma.project.findUnique({
 where: { id: id as string },
 include: {
 team: true,
 milestones: { orderBy: { order: 'asc' } },
 sprints: { orderBy: { order: 'asc' } },
 },
 });
 if (!project) return res.status(404).json({ error: 'Project not found' });
 res.status(200).json(project);
 } catch (err) {
 console.error('Project detail error:', err);
 res.status(500).json({ error: 'Failed to fetch project', details: err instanceof Error ? err.message : 'Unknown' });
 }
 } else if (req.method === 'PUT') {
 const { name, description, status, progress } = req.body;
 try {
 const project = await prisma.project.update({
 where: { id: id as string },
 data: {
 ...(name !== undefined && { name }),
 ...(description !== undefined && { description: description || null }),
 ...(status !== undefined && { status }),
 ...(progress !== undefined && { progress }),
 },
 include: { team: true, milestones: true, sprints: true },
 });
 res.status(200).json(project);
 } catch (err) {
 console.error('Project update error:', err);
 res.status(500).json({ error: 'Failed to update project', details: err instanceof Error ? err.message : 'Unknown' });
 }
 } else if (req.method === 'DELETE') {
 try {
 await prisma.project.delete({ where: { id: id as string } });
 res.status(200).json({ message: 'Deleted' });
 } catch (err) {
 console.error('Project delete error:', err);
 res.status(500).json({ error: 'Failed to delete project', details: err instanceof Error ? err.message : 'Unknown' });
 }
 } else {
 res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
