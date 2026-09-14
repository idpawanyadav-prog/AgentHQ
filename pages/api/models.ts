import { withAuth } from '../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 if (req.method === 'GET') {
 const agents = await prisma.agent.findMany({
 include: { member: true },
 });

 const modelMap: Record<string, { name: string; provider: string; type: string; assignments: number; agents: string[] }> = {};
 for (const a of agents) {
 const key = a.model;
 if (!modelMap[key]) {
 const provider = a.type === 'anthropic' ? 'Anthropic' : a.type === 'openai' ? 'OpenAI' : 'Unknown';
 modelMap[key] = { name: a.model, provider, type: a.type, assignments: 0, agents: [] };
 }
 modelMap[key].assignments += 1;
 modelMap[key].agents.push(a.name);
 }

 const models = Object.values(modelMap).map((m, i) => ({
 id: `model-${i}`,
 name: m.name,
 provider: m.provider,
 type: m.type,
 assignments: m.assignments,
 agentNames: m.agents,
 }));

 res.status(200).json(models);
 } else {
 res.setHeader('Allow', ['GET']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
