import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	const id = typeof req.query.id === 'string' ? req.query.id : '';
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
	const run = await prisma.executionRun.findUnique({ where: { id }, select: { artifacts: true, changedFiles: true, commands: true } });
	if (!run) return res.status(404).json({ error: 'ExecutionRun not found' });
	return res.status(200).json({
		artifacts: run.artifacts ? JSON.parse(run.artifacts) : [],
		changedFiles: run.changedFiles ? JSON.parse(run.changedFiles) : [],
		commands: run.commands ? JSON.parse(run.commands) : [],
	});
});
