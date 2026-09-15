import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

const validTypes = ['human', 'ai'];

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method === 'POST') {
		const { name, role, type, teamId } = req.body;
		if (typeof name !== 'string' || !name.trim()) {
			return res.status(400).json({ error: 'Name is required' });
		}
		if (typeof teamId !== 'string' || !teamId.trim()) {
			return res.status(400).json({ error: 'Team is required' });
		}
		if (!validTypes.includes(type)) {
			return res.status(400).json({ error: 'Valid employee type is required' });
		}
		if (type === 'ai' && (typeof role !== 'string' || !role.trim())) {
			return res.status(400).json({ error: 'Role is required for AI employees' });
		}

		const team = await prisma.team.findUnique({ where: { id: teamId } });
		if (!team) return res.status(400).json({ error: 'Team not found' });

		const member = await prisma.member.create({
			data: {
				name: name.trim(),
				role: type === 'human' ? 'Team Lead' : role.trim(),
				type,
				teamId,
			},
		});
		return res.status(201).json(member);
	}

	res.setHeader('Allow', ['POST']);
	return res.status(405).end(`Method ${req.method} Not Allowed`);
}

export default withAuth(handler);
