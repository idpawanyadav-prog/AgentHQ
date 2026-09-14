import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { id } = req.query;
 if (req.method === 'GET') {
 const team = await prisma.team.findUnique({
 where: { id: id as string },
 include: {
 members: true,
 tasks: { orderBy: { createdAt: 'desc' } },
 activities: { take: 20, orderBy: { createdAt: 'desc' } },
 },
 });
 if (!team) return res.status(404).json({ error: 'Team not found' });
 res.status(200).json(team);
 } else if (req.method === 'PUT') {
 const { name, description, status } = req.body;
 const team = await prisma.team.update({
 where: { id: id as string },
 data: {
 ...(name !== undefined && { name }),
 ...(description !== undefined && { description }),
 ...(status !== undefined && { status }),
 },
 include: { members: true, tasks: true },
 });
 res.status(200).json(team);
 } else if (req.method === 'DELETE') {
 await prisma.team.delete({ where: { id: id as string } });
 res.status(200).json({ message: 'Deleted' });
 } else {
 res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
