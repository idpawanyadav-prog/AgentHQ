const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

// Agent memory routes are public — no auth required

// ─── Role Groups ──────────────────────────────────────────────────────────────

// List all role groups with instructions, skills, and assignments
router.get('/role-groups', async (req, res) => {
	try {
		const roleGroups = await prisma.roleGroup.findMany({
			include: {
				instructions: { orderBy: { createdAt: 'asc' } },
				skills: { orderBy: { createdAt: 'asc' } },
				assignments: { orderBy: { createdAt: 'asc' } },
			},
			orderBy: { createdAt: 'desc' },
		});
		res.json({ success: true, data: roleGroups });
	} catch (err) {
		console.error('[List RoleGroups]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Get a single role group with its instructions, skills, and assignments
router.get('/role-groups/:id', async (req, res) => {
	try {
		const roleGroup = await prisma.roleGroup.findUnique({
			where: { id: req.params.id },
			include: {
				instructions: { orderBy: { createdAt: 'asc' } },
				skills: { orderBy: { createdAt: 'asc' } },
				assignments: { orderBy: { createdAt: 'asc' } },
			},
		});
		if (!roleGroup) {
			return res.status(404).json({ success: false, error: 'Role group not found' });
		}
		res.json({ success: true, data: roleGroup });
	} catch (err) {
		console.error('[Get RoleGroup]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Create role group
router.post('/role-groups', async (req, res) => {
	try {
		const { name, description, color } = req.body;
		if (!name) {
			return res.status(400).json({ success: false, error: 'name is required' });
		}
		const roleGroup = await prisma.roleGroup.create({
			data: {
				name,
				description: description || null,
				color: color || null,
			},
		});
		res.status(201).json({ success: true, data: roleGroup });
	} catch (err) {
		console.error('[Create RoleGroup]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Update role group
router.put('/role-groups/:id', async (req, res) => {
	try {
		const { name, description, color } = req.body;
		const roleGroup = await prisma.roleGroup.update({
			where: { id: req.params.id },
			data: {
				...(name !== undefined && { name }),
				...(description !== undefined && { description }),
				...(color !== undefined && { color }),
			},
		});
		res.status(200).json({ success: true, data: roleGroup });
	} catch (err) {
		if (err.code === 'P2025') {
			return res.status(404).json({ success: false, error: 'Role group not found' });
		}
		console.error('[Update RoleGroup]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Delete role group (cascades to instructions, skills, and assignments)
router.delete('/role-groups/:id', async (req, res) => {
	try {
		await prisma.roleGroup.delete({ where: { id: req.params.id } });
		res.status(204).end();
	} catch (err) {
		if (err.code === 'P2025') {
			return res.status(404).json({ success: false, error: 'Role group not found' });
		}
		console.error('[Delete RoleGroup]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// ─── Instruction Files ────────────────────────────────────────────────────────

// Create instruction file for a role group
router.post('/role-groups/:groupId/instructions', async (req, res) => {
	try {
		const { filename, title, content } = req.body;
		if (!filename || !content) {
			return res.status(400).json({
				success: false,
				error: 'filename and content are required',
			});
		}
		const roleGroup = await prisma.roleGroup.findUnique({
			where: { id: req.params.groupId },
		});
		if (!roleGroup) {
			return res.status(404).json({ success: false, error: 'Role group not found' });
		}
		const instruction = await prisma.instructionFile.create({
			data: {
				roleGroupId: req.params.groupId,
				filename,
				title: title || null,
				content,
			},
		});
		res.status(201).json({ success: true, data: instruction });
	} catch (err) {
		console.error('[Create Instruction]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Update instruction file
router.put('/instructions/:id', async (req, res) => {
	try {
		const { filename, title, content } = req.body;
		const instruction = await prisma.instructionFile.update({
			where: { id: req.params.id },
			data: {
				...(filename !== undefined && { filename }),
				...(title !== undefined && { title }),
				...(content !== undefined && { content }),
			},
		});
		res.status(200).json({ success: true, data: instruction });
	} catch (err) {
		if (err.code === 'P2025') {
			return res.status(404).json({ success: false, error: 'Instruction not found' });
		}
		console.error('[Update Instruction]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Delete instruction file
router.delete('/instructions/:id', async (req, res) => {
	try {
		await prisma.instructionFile.delete({ where: { id: req.params.id } });
		res.status(204).end();
	} catch (err) {
		if (err.code === 'P2025') {
			return res.status(404).json({ success: false, error: 'Instruction not found' });
		}
		console.error('[Delete Instruction]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// ─── Skills ──────────────────────────────────────────────────────────────────

// Create skill for a role group
router.post('/role-groups/:groupId/skills', async (req, res) => {
	try {
		const { name, level, description } = req.body;
		if (!name) {
			return res.status(400).json({ success: false, error: 'name is required' });
		}
		const roleGroup = await prisma.roleGroup.findUnique({
			where: { id: req.params.groupId },
		});
		if (!roleGroup) {
			return res.status(404).json({ success: false, error: 'Role group not found' });
		}
		const skill = await prisma.skill.create({
			data: {
				roleGroupId: req.params.groupId,
				name,
				level: level || 'intermediate',
				description: description || null,
			},
		});
		res.status(201).json({ success: true, data: skill });
	} catch (err) {
		console.error('[Create Skill]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Update skill
router.put('/skills/:id', async (req, res) => {
	try {
		const { name, level, description } = req.body;
		const skill = await prisma.skill.update({
			where: { id: req.params.id },
			data: {
				...(name !== undefined && { name }),
				...(level !== undefined && { level }),
				...(description !== undefined && { description }),
			},
		});
		res.status(200).json({ success: true, data: skill });
	} catch (err) {
		if (err.code === 'P2025') {
			return res.status(404).json({ success: false, error: 'Skill not found' });
		}
		console.error('[Update Skill]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Delete skill
router.delete('/skills/:id', async (req, res) => {
	try {
		await prisma.skill.delete({ where: { id: req.params.id } });
		res.status(204).end();
	} catch (err) {
		if (err.code === 'P2025') {
			return res.status(404).json({ success: false, error: 'Skill not found' });
		}
		console.error('[Delete Skill]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// ─── Agent Role Assignments ───────────────────────────────────────────────────

// Assign agent to role group
router.post('/role-groups/:groupId/assignments', async (req, res) => {
	try {
		const { agentId, agentName, agentStatus } = req.body;
		if (!agentId || !agentName) {
			return res.status(400).json({
				success: false,
				error: 'agentId and agentName are required',
			});
		}
		const roleGroup = await prisma.roleGroup.findUnique({
			where: { id: req.params.groupId },
		});
		if (!roleGroup) {
			return res.status(404).json({ success: false, error: 'Role group not found' });
		}
		const assignment = await prisma.agentRoleAssignment.upsert({
			where: {
				roleGroupId_agentId: {
					roleGroupId: req.params.groupId,
					agentId,
				},
			},
			update: {
				agentName,
				...(agentStatus !== undefined && { agentStatus }),
			},
			create: {
				roleGroupId: req.params.groupId,
				agentId,
				agentName,
				agentStatus: agentStatus || 'active',
			},
		});
		res.status(201).json({ success: true, data: assignment });
	} catch (err) {
		console.error('[Assign Agent]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

// Remove agent assignment
router.delete('/role-groups/:groupId/assignments/:agentId', async (req, res) => {
	try {
		await prisma.agentRoleAssignment.delete({
			where: {
				roleGroupId_agentId: {
					roleGroupId: req.params.groupId,
					agentId: req.params.agentId,
				},
			},
		});
		res.status(204).end();
	} catch (err) {
		if (err.code === 'P2025') {
			return res.status(404).json({ success: false, error: 'Assignment not found' });
		}
		console.error('[Remove Assignment]', err);
		res.status(500).json({ success: false, error: err.message });
	}
});

module.exports = router;
