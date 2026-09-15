import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../../lib/prisma';

const BENCH_TEAM_ID = 'on-bench';
const BENCH_TEAM_NAME = 'On Bench';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 if (req.method === 'GET') {
 const teams = await prisma.team.findMany({
 include: {
 members: { include: { agents: true } },
 tasks: true,
 activities: { take: 5, orderBy: { createdAt: 'desc' } },
 },
 orderBy: { createdAt: 'desc' },
 });
 res.status(200).json(teams);
 } else if (req.method === 'POST') {
 const { name, description, status } = req.body;
 if(typeof name !== "string" || !name.trim()) return res.status(400).json({error:"Name required"});
 if(status && !["active","paused","archived"].includes(status)) return res.status(400).json({error:"Invalid status"});
 if (name.trim().toLowerCase() === BENCH_TEAM_NAME.toLowerCase()) {
 const team = await prisma.team.upsert({
 where: { id: BENCH_TEAM_ID },
 update: {
 name: BENCH_TEAM_NAME,
 description: description || 'Agents not currently assigned to an active delivery team.',
 status: status || 'paused',
 },
 create: {
 id: BENCH_TEAM_ID,
 name: BENCH_TEAM_NAME,
 description: description || 'Agents not currently assigned to an active delivery team.',
 status: status || 'paused',
 },
 include: { members: true, tasks: true },
 });
 return res.status(201).json(team);
 }
 const team = await prisma.team.create({
 data: { name: name.trim(), description: description || null, status: status || "active" },
 include: { members: true, tasks: true },
 });
 res.status(201).json(team);
 } else {
 res.setHeader('Allow', ['GET', 'POST']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
