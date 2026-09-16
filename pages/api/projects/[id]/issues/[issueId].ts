import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../../lib/auth';
import prisma from '../../../../../lib/prisma';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	const issueId = typeof req.query.issueId === 'string' ? req.query.issueId : '';
	if (req.method !== 'PUT') return res.status(405).json({ error: 'Method not allowed' });
	const status = req.body?.status === 'resolved' ? 'resolved' : req.body?.status === 'open' ? 'open' : undefined;
	if (!status) return res.status(400).json({ error: 'status must be open or resolved' });
	const issue = await prisma.projectIssue.update({
		where: { id: issueId },
		data: { status, resolvedAt: status === 'resolved' ? new Date() : null },
	});
	return res.status(200).json(issue);
});
