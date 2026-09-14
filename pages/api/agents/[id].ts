import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { id } = req.query;
 if (req.method === 'GET') {
 const agent = await prisma.agent.findUnique({
 where: { id: id as string },
 include: { member: true, tasks: { include: { team: true } } },
 });
 if (!agent) return res.status(404).json({ error: 'Agent not found' });
 res.status(200).json(agent);
 } else if (req.method === 'PUT') {
 const { name, model, config, status } = req.body;
 const agent = await prisma.agent.update({
 where: { id: id as string },
 data: {
 ...(name !== undefined && { name }),
 ...(model !== undefined && { model }),
 ...(config !== undefined && { config: JSON.stringify(config) }),
 ...(status !== undefined && { status }),
 },
 include: { member: true, tasks: true },
 });
 res.status(200).json(agent);
 } else {
 res.setHeader('Allow', ['GET', 'PUT', 'POST']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
