import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

function roleGroupIcon(name: string): string {
	const lower = name.toLowerCase();
	if (lower.includes('design')) return 'paint-brush';
	if (lower.includes('qa') || lower.includes('test')) return 'tasks';
	if (lower.includes('manager') || lower.includes('pm')) return 'cog';
	return 'code';
}

function serializeRoleGroup(group: any) {
	const instructions = group.instructions || [];
	const skills = group.skills || [];
	const assignments = group.assignments || [];

	return {
		id: group.id,
		name: group.name,
		subtitle: group.description || 'Role-based instructions and skills',
		description: group.description,
		color: group.color,
		icon: roleGroupIcon(group.name),
		instructionCount: instructions.length,
		skillCount: skills.length,
		instructions: instructions.map((instruction: any) => ({
			id: instruction.id,
			roleGroupId: instruction.roleGroupId,
			filename: instruction.filename,
			title: instruction.title || instruction.filename,
			description: instruction.title || instruction.filename,
			content: instruction.content,
			createdAt: instruction.createdAt.toISOString(),
			updatedAt: instruction.updatedAt.toISOString(),
		})),
		skills: skills.map((skill: any) => ({
			id: skill.id,
			roleGroupId: skill.roleGroupId,
			name: skill.name,
			level: skill.level,
			description: skill.description || '',
			createdAt: skill.createdAt.toISOString(),
			updatedAt: skill.updatedAt.toISOString(),
		})),
		assignments: assignments.map((assignment: any) => ({
			id: assignment.id,
			roleGroupId: assignment.roleGroupId,
			agentId: assignment.agentId,
			agentName: assignment.agentName,
			agentStatus: assignment.agentStatus,
			createdAt: assignment.createdAt.toISOString(),
			updatedAt: assignment.updatedAt.toISOString(),
		})),
		createdAt: group.createdAt.toISOString(),
		updatedAt: group.updatedAt.toISOString(),
	};
}

// GET /api/agent-memory - list role groups
// POST /api/agent-memory - create role group
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method === 'GET') {
		try {
			const groups = await prisma.roleGroup.findMany({
				include: {
					instructions: { orderBy: { createdAt: 'asc' } },
					skills: { orderBy: { createdAt: 'asc' } },
					assignments: { orderBy: { createdAt: 'asc' } },
				},
				orderBy: { createdAt: 'desc' },
			});
			const result = groups.map(serializeRoleGroup);
			res.status(200).json(result);
		} catch (err) {
			console.error('[List RoleGroups]', err);
			res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch role groups' });
		}
	} else if (req.method === 'POST') {
		try {
			const { name, description, color } = req.body;
			if (!name || typeof name !== 'string') {
				return res.status(400).json({ error: 'name is required' });
			}
			const group = await prisma.roleGroup.create({
				data: { name: name.trim(), description: description?.trim() || null, color: color?.trim() || null },
				include: {
					instructions: true,
					skills: true,
					assignments: true,
				},
			});
			res.status(201).json(serializeRoleGroup(group));
		} catch (err) {
			console.error('[Create RoleGroup]', err);
			res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create role group' });
		}
	} else {
		res.setHeader('Allow', ['GET', 'POST']);
		res.status(405).end(`Method ${req.method} Not Allowed`);
	}
}
