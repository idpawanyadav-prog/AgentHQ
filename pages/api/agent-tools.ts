import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../lib/auth';
import {
	ensureAgentToolsRegistered,
	listManagementTools,
	listManagementToolsForContext,
	executeManagementToolCall,
} from '../../lib/agent-tools/management-tools';

export default withAuth(async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method === 'GET') {
		ensureAgentToolsRegistered();
		const context = {
			actorType: 'project-control' as const,
			now: new Date(),
		};
		const tools = listManagementToolsForContext(context);
		return res.status(200).json(tools);
	}

	if (req.method === 'POST') {
		const { id, name, arguments: args } = req.body || {};
		if (!name || typeof name !== 'string') {
			return res.status(400).json({ error: 'Tool name is required' });
		}
		if (typeof args !== 'object' || args === null) {
			return res.status(400).json({ error: 'arguments must be an object' });
		}
		const context = {
			actorType: 'project-control' as const,
			now: new Date(),
		};
		const result = await executeManagementToolCall({ id: id || crypto.randomUUID(), name, arguments: args }, context);
		if (!result.ok) {
			return res.status(400).json({ error: result.error?.message ?? 'Unknown error' });
		}
		return res.status(200).json(result.data);
	}

	res.setHeader('Allow', ['GET', 'POST']);
	return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
});
