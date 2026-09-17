import { withAuth } from '../../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import { runProjectOrchestrationCycle } from '../../../../lib/orchestration/project-orchestrator';

async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', ['POST']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  const { id } = req.query;
  if (!id || typeof id !== 'string') {
    return res.status(400).json({ error: 'Project id is required' });
  }

  try {
    const mode = typeof req.body?.mode === 'string'
      ? req.body.mode
      : 'manual';

    const result = await runProjectOrchestrationCycle(id);

    return res.status(200).json({
      projectId: id,
      mode,
      counts: {
        queued: result.readyTasks,
        ready: result.assignments,
        blocked: result.stalled.stalledTasks,
        stalled: result.stalled.stalledExecutions,
      },
    });
  } catch (err) {
    return res.status(500).json({ error: err instanceof Error ? err.message : 'Orchestration failed' });
  }
}

export default withAuth(handler);