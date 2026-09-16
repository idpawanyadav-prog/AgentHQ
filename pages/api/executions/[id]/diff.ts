import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';
import { gitCommittedDiff } from '../../../../lib/workspace/workspace-service';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	const id = typeof req.query.id === 'string' ? req.query.id : '';
	if (req.method !== 'GET') return res.status(405).json({ error: 'Method not allowed' });
	const workspace = await prisma.workspace.findFirst({ where: { executionRunId: id }, orderBy: { createdAt: 'desc' } });
	if (!workspace) return res.status(404).json({ error: 'Workspace not found' });
	return res.status(200).json({ diff: gitCommittedDiff(workspace.path, workspace.baseCommit, workspace.headCommit).slice(0, 100_000) });
});
