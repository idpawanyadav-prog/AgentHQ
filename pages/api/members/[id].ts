import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

const validTypes = ['human', 'ai'];

async function handler(req: NextApiRequest, res: NextApiResponse) {
	const { id } = req.query;
	const memberId = id as string;

	if (req.method === 'PUT') {
		const { name, role, type, teamId } = req.body;
		const data: Record<string, string> = {};

		if (name !== undefined) {
			if (typeof name !== 'string' || !name.trim()) {
				return res.status(400).json({ error: 'Name is required' });
			}
			data.name = name.trim();
		}
		if (teamId !== undefined) {
			if (typeof teamId !== 'string' || !teamId.trim()) {
				return res.status(400).json({ error: 'Team is required' });
			}
			const team = await prisma.team.findUnique({ where: { id: teamId } });
			if (!team) return res.status(400).json({ error: 'Team not found' });
			data.teamId = teamId;
		}
		if (type !== undefined) {
			if (!validTypes.includes(type)) {
				return res.status(400).json({ error: 'Valid employee type is required' });
			}
			data.type = type;
			data.role = type === 'human' ? 'Team Lead' : String(role || '').trim();
			if (type === 'ai' && !data.role) {
				return res.status(400).json({ error: 'Role is required for AI employees' });
			}
		} else if (role !== undefined) {
			if (typeof role !== 'string' || !role.trim()) {
				return res.status(400).json({ error: 'Role is required' });
			}
			data.role = role.trim();
		}

		const member = await prisma.member.update({
			where: { id: memberId },
			data,
		});
		return res.status(200).json(member);
	}

	if (req.method === 'DELETE') {
		const member = await prisma.member.findUnique({
			where: { id: memberId },
			include: { agents: true },
		});
		if (!member) return res.status(404).json({ error: 'Member not found' });

		const agentIds = member.agents.map((agent) => agent.id);
		await prisma.$transaction(async (tx) => {
			await tx.task.updateMany({
				where: { assigneeId: member.id },
				data: { assigneeId: null },
			});
			if (agentIds.length > 0) {
				await tx.task.updateMany({
					where: { agentId: { in: agentIds } },
					data: { agentId: null },
				});
				await tx.agentRoleAssignment.deleteMany({
					where: { agentId: { in: agentIds } },
				});
			}
			await tx.activity.updateMany({
				where: { memberId: member.id },
				data: { memberId: null },
			});
			await tx.member.delete({
				where: { id: member.id },
			});
		});
		return res.status(204).end();
	}

	res.setHeader('Allow', ['PUT', 'DELETE']);
	return res.status(405).end(`Method ${req.method} Not Allowed`);
}

export default withAuth(handler);
