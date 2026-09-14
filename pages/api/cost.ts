import { withAuth } from '../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';
import { summarizeUsage } from '../../lib/usage';
async function handler(req: NextApiRequest, res: NextApiResponse) {
 if(req.method !== 'GET') return res.status(405).json({error:'Method not allowed'});
 const events = await prisma.activity.findMany();
 return res.json(summarizeUsage(events));
}

export default withAuth(handler);
