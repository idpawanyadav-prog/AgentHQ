import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { proposeExecution } from '../../../lib/execution/execution-service';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
	const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
	if (!projectId || !message) return res.status(400).json({ error: 'projectId and message are required' });
	try {
		const proposal = await proposeExecution({
			projectId,
			message: message.slice(0, 8000),
			taskId: typeof req.body?.taskId === 'string' ? req.body.taskId : undefined,
			agentId: typeof req.body?.agentId === 'string' ? req.body.agentId : undefined,
			squadId: typeof req.body?.squadId === 'string' ? req.body.squadId : undefined,
			engine: typeof req.body?.engine === 'string' ? req.body.engine : undefined,
			mode: req.body?.mode === 'analysis' ? 'analysis' : req.body?.mode === 'coding' ? 'coding' : undefined,
			configuredModelId: typeof req.body?.configuredModelId === 'string' ? req.body.configuredModelId : undefined,
		});
		return res.status(201).json(proposal);
	} catch (err) {
		return res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to propose execution' });
	}
});
