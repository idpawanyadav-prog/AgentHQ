import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import { approveExecutionProposal } from '../../../../lib/execution/execution-service';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	const proposalId = typeof req.query.id === 'string' ? req.query.id : '';
	try {
		const run = await approveExecutionProposal(proposalId, req.body?.approved === true);
		return res.status(202).json(run);
	} catch (err) {
		const status = (err as Error & { status?: number }).status || 400;
		return res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to approve execution' });
	}
});
