import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
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
 try {
 const { name, type, model, memberId, teamId: bodyTeamId, config } = req.body;
 if (![name, model].every(v => typeof v === 'string' && v.trim()) || !['openai','anthropic','custom'].includes(type)) {
 return res.status(400).json({error:'Valid name, model and gateway provider are required'});
 }
 if (!memberId && (typeof bodyTeamId !== 'string' || !bodyTeamId.trim())) {
 return res.status(400).json({error:'teamId is required'});
 }
 const agent = await prisma.$transaction(async (tx) => {
 let resolvedMemberId = memberId;
 if (resolvedMemberId) {
 const member = await tx.member.findUnique({where:{id:resolvedMemberId}});
 if (!member) throw new Error('Member not found');
 } else {
 const team = await tx.team.findUnique({where:{id:bodyTeamId}});
 if (!team) throw new Error('Team not found');
 const member = await tx.member.create({
 data: {
 name: name.trim(),
 role: 'AI Agent',
 type: 'ai',
 teamId: bodyTeamId,
 },
 });
 resolvedMemberId = member.id;
 }
 return tx.agent.create({
 data: {
 name: name.trim(),
 type,
 model: model.trim(),
 memberId: resolvedMemberId,
 config: config ? JSON.stringify(config) : "{}",
 status: 'idle',
 },
 include: { member: true },
 });
 });
 res.status(201).json(agent);
 } catch (err) {
 const message = err instanceof Error ? err.message : 'Failed to create agent';
 const status = message === 'Member not found' || message === 'Team not found' ? 400 : 500;
 res.status(status).json({error: message});
 return;
 }
 } else {
 res.setHeader('Allow', ['GET', 'POST']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
