import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import { approveExecution } from '../../../../lib/execution/execution-service';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	try {
		const run = await approveExecution(req.body?.proposal, req.body?.approved === true);
		return res.status(200).json(run);
	} catch (err) {
		const status = (err as Error & { status?: number }).status || 400;
		return res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to approve execution' });
	}
});
