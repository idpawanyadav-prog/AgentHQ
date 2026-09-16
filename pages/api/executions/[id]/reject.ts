import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	const id = typeof req.query.id === 'string' ? req.query.id : '';
	const proposal = await prisma.executionProposal.update({
		where: { id },
		data: { status: 'rejected', rejectedAt: new Date() },
	});
	return res.status(200).json(proposal);
});
