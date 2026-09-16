import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { getProjectControlStatus } from '../../../lib/project-control';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'GET') {
		res.setHeader('Allow', ['GET']);
		return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
	}
	const projectId = typeof req.query.projectId === 'string' ? req.query.projectId.trim() : '';
	if (!projectId) return res.status(400).json({ error: 'projectId is required' });
	const status = await getProjectControlStatus(projectId);
	if (!status) return res.status(404).json({ error: 'Project not found' });
	return res.status(200).json(status);
});
