import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { id } = req.query;
 if (req.method === 'GET') {
 const milestones = await prisma.milestone.findMany({
 where: { projectId: id as string },
 orderBy: { order: 'asc' },
 });
 res.status(200).json(milestones);
 } else if (req.method === 'POST') {
 const { title, status, order } = req.body;
 if (!title) return res.status(400).json({ error: 'title is required' });
 const milestone = await prisma.milestone.create({
 data: {
 title,
 status: status || 'pending',
 order: order ?? 0,
 projectId: id as string,
 },
 });
 res.status(201).json(milestone);
 } else {
 res.setHeader('Allow', ['GET', 'POST']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
