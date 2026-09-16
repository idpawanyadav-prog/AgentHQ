import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import prisma from '../../../lib/prisma';
import { applyStaffing, proposeStaffing } from '../../../lib/project-control';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') {
		res.setHeader('Allow', ['POST']);
		return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
	}
	const action = typeof req.body?.action === 'string' ? req.body.action : '';
	const projectId = typeof req.body?.projectId === 'string' ? req.body.projectId.trim() : '';
	if (!projectId) return res.status(400).json({ error: 'projectId is required' });

	if (action === 'propose') {
		const requirement = typeof req.body?.requirement === 'string' ? req.body.requirement.slice(0, 8000) : '';
		const targetAgentCount = req.body?.targetAgentCount === undefined ? undefined : Number(req.body.targetAgentCount);
		if (targetAgentCount !== undefined && (!Number.isFinite(targetAgentCount) || targetAgentCount < 0)) {
			return res.status(400).json({ error: 'targetAgentCount must be 0 or greater' });
		}
		const proposal = await proposeStaffing(projectId, { requirement, targetAgentCount });
		const status = await prisma.project.findUnique({ where: { id: projectId }, select: { teamId: true, name: true } });
		if (status) {
			await prisma.activity.create({
				data: {
					teamId: status.teamId,
					type: 'staffing_proposed',
					description: `Project Control proposed staffing for ${status.name}`,
					meta: JSON.stringify({ projectId, targetAgentCount: proposal.targetAgentCount, hires: proposal.hires.length, removals: proposal.removals.length }),
				},
			});
		}
		return res.status(200).json(proposal);
	}

	if (action === 'apply') {
		try {
			const result = await applyStaffing(projectId, {
				approved: req.body?.approved,
				hires: req.body?.hires,
				removals: req.body?.removals,
			});
			return res.status(200).json(result);
		} catch (err) {
			const status = (err as Error & { status?: number }).status || (/cannot be removed|not on this Project|not found|required/i.test((err as Error).message) ? 400 : 500);
			return res.status(status).json({ error: err instanceof Error ? err.message : 'Failed to apply staffing' });
		}
	}

	return res.status(400).json({ error: 'action must be propose or apply' });
});
