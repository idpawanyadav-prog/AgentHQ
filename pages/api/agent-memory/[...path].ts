import { withAuth } from '../../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../../lib/prisma';

function roleGroupIcon(name: string): string {
	const lower = name.toLowerCase();
	if (lower.includes('design')) return 'paint-brush';
	if (lower.includes('qa') || lower.includes('test')) return 'tasks';
	if (lower.includes('manager') || lower.includes('pm')) return 'cog';
	return 'code';
}

function serializeInstruction(instruction: any) {
	return {
		id: instruction.id,
		roleGroupId: instruction.roleGroupId,
		filename: instruction.filename,
		title: instruction.title || instruction.filename,
		description: instruction.title || instruction.filename,
		content: instruction.content,
		updatedAt: instruction.updatedAt.toISOString(),
		createdAt: instruction.createdAt.toISOString(),
	};
}

function serializeSkill(skill: any) {
	return {
		id: skill.id,
		roleGroupId: skill.roleGroupId,
		name: skill.name,
		level: skill.level,
		description: skill.description || '',
		createdAt: skill.createdAt.toISOString(),
		updatedAt: skill.updatedAt.toISOString(),
	};
}

function serializeAssignment(assignment: any) {
	return {
		id: assignment.id,
		roleGroupId: assignment.roleGroupId,
		agentId: assignment.agentId,
		agentName: assignment.agentName,
		agentStatus: assignment.agentStatus,
		createdAt: assignment.createdAt.toISOString(),
		updatedAt: assignment.updatedAt.toISOString(),
	};
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
	const { path } = req.query as { path?: string[] };
	const segments = path || [];
	const [entity, entityId, action, subId] = segments;

	// ─── Role Groups ──────────────────────────────────────────────────────────

	if (entity === 'role-groups' && entityId && !action) {
		if (req.method === 'GET') {
			try {
				const group = await prisma.roleGroup.findUnique({
					where: { id: entityId },
					include: {
						instructions: { orderBy: { createdAt: 'asc' } },
						skills: { orderBy: { createdAt: 'asc' } },
						assignments: { orderBy: { createdAt: 'asc' } },
					},
				});
				if (!group) {
					return res.status(404).json({ error: 'Role group not found' });
				}
				const result = {
					id: group.id,
					name: group.name,
					subtitle: group.description || 'Role-based instructions and skills',
					description: group.description,
					color: group.color,
					icon: roleGroupIcon(group.name),
					instructionCount: group.instructions.length,
					skillCount: group.skills.length,
					instructions: group.instructions.map(serializeInstruction),
					skills: group.skills.map(serializeSkill),
					assignments: group.assignments.map(serializeAssignment),
					createdAt: group.createdAt.toISOString(),
					updatedAt: group.updatedAt.toISOString(),
				};
				res.status(200).json(result);
			} catch (err) {
				console.error('[Get RoleGroup]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to fetch role group' });
			}
			return;
		}

		if (req.method === 'PUT' && !action) {
			try {
				const { name, description, color } = req.body;
				const group = await prisma.roleGroup.update({
					where: { id: entityId },
					data: {
						...(name !== undefined && { name }),
						...(description !== undefined && { description }),
						...(color !== undefined && { color }),
					},
					include: {
						instructions: { orderBy: { createdAt: 'asc' } },
						skills: { orderBy: { createdAt: 'asc' } },
						assignments: { orderBy: { createdAt: 'asc' } },
					},
				});
				res.status(200).json({
					id: group.id,
					name: group.name,
					subtitle: group.description || 'Role-based instructions and skills',
					description: group.description,
					color: group.color,
					icon: roleGroupIcon(group.name),
					instructionCount: group.instructions.length,
					skillCount: group.skills.length,
					instructions: group.instructions.map(serializeInstruction),
					skills: group.skills.map(serializeSkill),
					assignments: group.assignments.map(serializeAssignment),
					createdAt: group.createdAt.toISOString(),
					updatedAt: group.updatedAt.toISOString(),
				});
			} catch (err) {
				console.error('[Update RoleGroup]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update role group' });
			}
			return;
		}

		if (req.method === 'DELETE' && !action) {
			try {
				await prisma.roleGroup.delete({ where: { id: entityId } });
				res.status(204).end();
			} catch (err) {
				console.error('[Delete RoleGroup]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete role group' });
			}
			return;
		}
	}

	// ─── Instructions ─────────────────────────────────────────────────────────

	if (entity === 'role-groups' && action === 'instructions' && entityId) {
		if (req.method === 'POST') {
			try {
				const { filename, title, content } = req.body;
				if (!filename || !content) {
					return res.status(400).json({ error: 'filename and content are required' });
				}
				const group = await prisma.roleGroup.findUnique({ where: { id: entityId } });
				if (!group) {
					return res.status(404).json({ error: 'Role group not found' });
				}
				const instruction = await prisma.instructionFile.create({
					data: { roleGroupId: entityId, filename, title: title || null, content },
				});
				res.status(201).json(serializeInstruction(instruction));
			} catch (err) {
				console.error('[Create Instruction]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create instruction' });
			}
			return;
		}
	}

	if (entity === 'instructions' && entityId && !action) {
		if (req.method === 'PUT') {
			try {
				const { filename, title, content } = req.body;
				const instruction = await prisma.instructionFile.update({
					where: { id: entityId },
					data: {
						...(filename !== undefined && { filename }),
						...(title !== undefined && { title }),
						...(content !== undefined && { content }),
					},
				});
				res.status(200).json(serializeInstruction(instruction));
			} catch (err) {
				console.error('[Update Instruction]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update instruction' });
			}
			return;
		}

		if (req.method === 'DELETE') {
			try {
				await prisma.instructionFile.delete({ where: { id: entityId } });
				res.status(204).end();
			} catch (err) {
				console.error('[Delete Instruction]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete instruction' });
			}
			return;
		}
	}

	// ─── Skills ───────────────────────────────────────────────────────────────

	if (entity === 'role-groups' && action === 'skills' && entityId) {
		if (req.method === 'POST') {
			try {
				const { name, level, description } = req.body;
				if (!name) {
					return res.status(400).json({ error: 'name is required' });
				}
				const group = await prisma.roleGroup.findUnique({ where: { id: entityId } });
				if (!group) {
					return res.status(404).json({ error: 'Role group not found' });
				}
				const skill = await prisma.skill.create({
					data: {
						roleGroupId: entityId,
						name,
						level: level || 'intermediate',
						description: description || null,
					},
				});
				res.status(201).json(serializeSkill(skill));
			} catch (err) {
				console.error('[Create Skill]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to create skill' });
			}
			return;
		}
	}

	if (entity === 'skills' && entityId && !action) {
		if (req.method === 'PUT') {
			try {
				const { name, level, description } = req.body;
				const skill = await prisma.skill.update({
					where: { id: entityId },
					data: {
						...(name !== undefined && { name }),
						...(level !== undefined && { level }),
						...(description !== undefined && { description }),
					},
				});
				res.status(200).json(serializeSkill(skill));
			} catch (err) {
				console.error('[Update Skill]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to update skill' });
			}
			return;
		}

		if (req.method === 'DELETE') {
			try {
				await prisma.skill.delete({ where: { id: entityId } });
				res.status(204).end();
			} catch (err) {
				console.error('[Delete Skill]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to delete skill' });
			}
			return;
		}
	}

	// ─── Assignments ──────────────────────────────────────────────────────────

	if (entity === 'role-groups' && action === 'assignments' && entityId) {
		if (req.method === 'POST') {
			try {
				const { agentId, agentName, agentStatus } = req.body;
				if (!agentId || !agentName) {
					return res.status(400).json({ error: 'agentId and agentName are required' });
				}
				const group = await prisma.roleGroup.findUnique({ where: { id: entityId } });
				if (!group) {
					return res.status(404).json({ error: 'Role group not found' });
				}
				const assignment = await prisma.agentRoleAssignment.upsert({
					where: { roleGroupId_agentId: { roleGroupId: entityId, agentId } },
					update: { agentName, ...(agentStatus !== undefined && { agentStatus }) },
					create: { roleGroupId: entityId, agentId, agentName, agentStatus: agentStatus || 'active' },
				});
				res.status(201).json(serializeAssignment(assignment));
			} catch (err) {
				console.error('[Assign Agent]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to assign agent' });
			}
			return;
		}

		if (req.method === 'DELETE' && subId) {
			try {
				await prisma.agentRoleAssignment.delete({
					where: { roleGroupId_agentId: { roleGroupId: entityId, agentId: subId } },
				});
				res.status(204).end();
			} catch (err) {
				console.error('[Remove Assignment]', err);
				res.status(500).json({ error: err instanceof Error ? err.message : 'Failed to remove assignment' });
			}
			return;
		}
	}

	res.setHeader('Allow', ['GET', 'PUT', 'DELETE', 'POST']);
	res.status(405).end(`Method ${req.method} Not Allowed`);
}

export default withAuth(handler);
