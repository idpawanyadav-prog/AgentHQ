import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
	const projectId = typeof req.query.projectId === 'string' ? req.query.projectId : undefined;
	const squads = await prisma.dynamicSquad.findMany({
		where: { projectId },
		include: { members: true },
		orderBy: { createdAt: 'desc' },
	});
	return res.status(200).json(squads);
});
