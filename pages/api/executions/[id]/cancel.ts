import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import prisma from '../../../../lib/prisma';
import { getExecutionEngine } from '../../../../lib/execution/engine-registry';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	const id = typeof req.query.id === 'string' ? req.query.id : '';
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
	const run = await prisma.executionRun.findUnique({ where: { id }, include: { project: true } });
	if (!run) return res.status(404).json({ error: 'ExecutionRun not found' });
	await getExecutionEngine(run.engine).cancel(run.id);
	const updated = await prisma.executionRun.update({ where: { id }, data: { status: 'cancelled', finishedAt: new Date(), failureReason: 'Cancelled by user' } });
	await prisma.activity.create({
		data: {
			teamId: run.project.teamId,
			type: 'execution_cancelled',
			description: 'Execution cancelled',
			meta: JSON.stringify({ projectId: run.projectId, runId: run.id }),
		},
	});
	return res.status(200).json(updated);
});
