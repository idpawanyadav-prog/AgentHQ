import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 const { teamId } = req.query;
 if (req.method === 'GET') {
 const agents = await prisma.agent.findMany({
 where: teamId && teamId !== 'undefined' ? { member: { teamId: teamId as string } } : {},
 include: { member: true, tasks: true },
 orderBy: { createdAt: 'desc' },
 });
 res.status(200).json(agents);
 } else if (req.method === 'POST') {
 const { name, type, model, memberId, config } = req.body;
 if (![name, model, memberId].every(v => typeof v === 'string' && v.trim()) || !['openai','anthropic'].includes(type)) return res.status(400).json({error:'Valid name, model, memberId and provider are required'});
 if (!await prisma.member.findUnique({where:{id:memberId}})) return res.status(400).json({error:'Member not found'});
 const agent = await prisma.agent.create({
 data: {
 name,
 type,
 model,
 memberId,
 config: config ? JSON.stringify(config) : "{}",
 status: 'idle',
 },
 include: { member: true },
 });
 res.status(201).json(agent);
 } else {
 res.setHeader('Allow', ['GET', 'POST']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
