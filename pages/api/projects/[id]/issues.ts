import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';

const SEVERITIES = new Set(['P0', 'P1', 'P2', 'P3']);

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	const projectId = typeof req.query.id === 'string' ? req.query.id : '';
	if (!projectId) return res.status(400).json({ error: 'project id is required' });
	if (req.method === 'GET') {
		const issues = await prisma.projectIssue.findMany({ where: { projectId }, orderBy: { createdAt: 'desc' } });
		return res.status(200).json(issues);
	}
	if (req.method === 'POST') {
		const severity = typeof req.body?.severity === 'string' && SEVERITIES.has(req.body.severity) ? req.body.severity : '';
		const title = typeof req.body?.title === 'string' ? req.body.title.trim() : '';
		if (!severity || !title) return res.status(400).json({ error: 'severity and title are required' });
		const issue = await prisma.projectIssue.create({
			data: {
				projectId,
				severity,
				title,
				description: typeof req.body?.description === 'string' ? req.body.description : null,
				source: 'project-control',
			},
		});
		return res.status(201).json(issue);
	}
	return res.status(405).json({ error: 'Method not allowed' });
});
