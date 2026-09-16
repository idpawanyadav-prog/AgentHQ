import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';
import { getOrCreateGovernance } from '../../../../lib/governance/execution-gates';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	const projectId = typeof req.query.id === 'string' ? req.query.id : '';
	if (!projectId) return res.status(400).json({ error: 'project id is required' });
	if (req.method === 'GET') return res.status(200).json(await getOrCreateGovernance(projectId));
	if (req.method === 'PUT') {
		const project = await prisma.project.findUnique({ where: { id: projectId } });
		if (!project) return res.status(404).json({ error: 'Project not found' });
		const data = {
			...(typeof req.body?.humanDirectives === 'string' && { humanDirectives: req.body.humanDirectives.slice(0, 8000) }),
			...(typeof req.body?.forbiddenActions === 'string' && { forbiddenActions: req.body.forbiddenActions.slice(0, 8000) }),
			...(typeof req.body?.architectureRules === 'string' && { architectureRules: req.body.architectureRules.slice(0, 8000) }),
			...(typeof req.body?.approvalRules === 'string' && { approvalRules: req.body.approvalRules.slice(0, 8000) }),
			...(req.body?.maxDailyTokens === null || Number.isFinite(Number(req.body?.maxDailyTokens)) ? { maxDailyTokens: req.body.maxDailyTokens === null ? null : Number(req.body.maxDailyTokens) } : {}),
			...(req.body?.maxDailyCostUsd === null || Number.isFinite(Number(req.body?.maxDailyCostUsd)) ? { maxDailyCostUsd: req.body.maxDailyCostUsd === null ? null : Number(req.body.maxDailyCostUsd) } : {}),
			...(req.body?.maxConcurrentRuns === null || Number.isFinite(Number(req.body?.maxConcurrentRuns)) ? { maxConcurrentRuns: req.body.maxConcurrentRuns === null ? null : Number(req.body.maxConcurrentRuns) } : {}),
			...(typeof req.body?.allowShell === 'boolean' && { allowShell: req.body.allowShell }),
			...(typeof req.body?.allowRemotePush === 'boolean' && { allowRemotePush: req.body.allowRemotePush }),
			...(typeof req.body?.allowAutoPr === 'boolean' && { allowAutoPr: req.body.allowAutoPr }),
		};
		const saved = await prisma.projectGovernance.upsert({ where: { projectId }, create: { projectId, ...data }, update: data });
		await prisma.activity.create({
			data: {
				teamId: project.teamId,
				type: 'governance_changed',
				description: 'Project governance changed',
				meta: JSON.stringify({ projectId, changedKeys: Object.keys(data) }),
			},
		});
		return res.status(200).json(saved);
	}
	return res.status(405).json({ error: 'Method not allowed' });
});
