import { withAuth } from '../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import prisma from '../../lib/prisma';

async function handler(req: NextApiRequest, res: NextApiResponse) {
 if (req.method === 'GET') {
 const settings = await prisma.setting.findMany({where:{key:{not:"dashboard_auth"}}});
 const map: Record<string, string> = {};
 settings.forEach((s) => { map[s.key] = s.value; });
 res.status(200).json(map);
 } else if (req.method === 'PUT') {
 const body = req.body;
 if (!body || typeof body !== 'object') return res.status(400).json({ error: 'Invalid body' });
 const entries = Object.entries(body);
 if (entries.some(([key]) => !['ai_rate_limit_max','ai_rate_limit_window_ms','default_anthropic_model','default_openai_model'].includes(key))) return res.status(400).json({error:'Unknown setting'});
 const results: Record<string, unknown> = {};
 for (const [key, value] of entries) {
 const strVal = typeof value === 'string' ? value : JSON.stringify(value);
 const setting = await prisma.setting.upsert({
 where: { key },
 update: { value: strVal },
 create: { key, value: strVal },
 });
 results[key] = setting.value;
 }
 res.status(200).json(results);
 } else {
 res.setHeader('Allow', ['GET', 'PUT']);
 res.status(405).end(`Method ${req.method} Not Allowed`);
 }
}

export default withAuth(handler);
