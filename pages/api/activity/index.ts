import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { teamId } = req.query;
 const limit = parseInt((req.query.limit as string) || '50', 10);
 if (req.method === 'GET') {
 const activities = await prisma.activity.findMany({
 where: teamId && teamId !== 'undefined' ? { teamId: teamId as string } : {},
 include: { member: true, task: true, team: true },
 orderBy: { createdAt: 'desc' },
 take: limit,
 });
 res.status(200).json(activities);
 } else {
 res.setHeader('Allow', ['GET']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
