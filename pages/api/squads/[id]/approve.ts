import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import { createSquadFromProposal } from '../../../../lib/squads/squad-planner';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	if (req.body?.approved !== true) return res.status(400).json({ error: 'Explicit approval is required.' });
	try {
		const squad = await createSquadFromProposal(req.body?.proposal);
		return res.status(201).json(squad);
	} catch (err) {
		return res.status(400).json({ error: err instanceof Error ? err.message : 'Failed to create squad' });
	}
});
