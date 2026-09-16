import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import prisma from '../../../lib/prisma';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	const id = typeof req.query.id === 'string' ? req.query.id : '';
	if (!id) return res.status(400).json({ error: 'id is required' });
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
	const run = await prisma.executionRun.findUnique({
		where: { id },
		include: { workspaces: true, checkpoints: { orderBy: { createdAt: 'asc' } } },
	});
	if (!run) return res.status(404).json({ error: 'ExecutionRun not found' });
	return res.status(200).json(run);
});
