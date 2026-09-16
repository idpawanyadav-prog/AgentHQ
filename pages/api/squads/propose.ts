import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { proposeSquad } from '../../../lib/squads/squad-planner';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId : '';
	const requirement = typeof req.body?.requirement === 'string' ? req.body.requirement.trim() : '';
	if (!projectId || !requirement) return res.status(400).json({ error: 'projectId and requirement are required' });
	try {
		const proposal = await proposeSquad(projectId, { requirement, taskId: typeof req.body?.taskId === 'string' ? req.body.taskId : undefined });
		return res.status(200).json(proposal);
	} catch (err) {
		return res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to propose squad' });
	}
});
