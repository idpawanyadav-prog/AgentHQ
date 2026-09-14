const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { broadcastActivity, broadcastTaskUpdate } = require('../socket');
const { withAuth } = require('../middleware/auth');
const { validate, createTaskSchema, updateTaskSchema, assignTaskSchema } = require('../middleware/validate');

// ─── List tasks ───────────────────────────────────────────────────────────────
router.get('/', withAuth, async (req, res) => {
 try {
 const { teamId, status, agentId, assigneeId } = req.query;

 const where = {};
 if (teamId) where.teamId = teamId;
 if (status) where.status = status;
 if (agentId) where.agentId = agentId;
 if (assigneeId) where.assigneeId = assigneeId;

 const tasks = await prisma.task.findMany({
 where,
 include: {
 team: { select: { id: true, name: true } },
 assignee: { select: { id: true, name: true, type: true, avatar: true } },
 agent: { select: { id: true, name: true, type: true, model: true, status: true } },
 },
 orderBy: [
 { priority: 'desc' }, // critical first
 { createdAt: 'asc' },
 ],
 });

 res.json(tasks);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// ─── Get a single task ────────────────────────────────────────────────────────
router.get('/:id', withAuth, async (req, res) => {
 try {
 const task = await prisma.task.findUnique({
 where: { id: req.params.id },
 include: {
 team: { select: { id: true, name: true } },
 assignee: { select: { id: true, name: true, type: true, avatar: true } },
 agent: { select: { id: true, name: true, type: true, model: true, status: true, config: true } },
 },
 });
 if (!task) return res.status(404).json({ error: 'Task not found' });
 res.json(task);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// ─── Create a task ────────────────────────────────────────────────────────────
router.post('/', withAuth, validate(createTaskSchema), async (req, res) => {
 try {
 const { title, description, priority, status, teamId, assigneeId, agentId, branch, dependencies } = req.body;

 if (!title || !title.trim()) {
 return res.status(400).json({ error: 'Task title is required' });
 }

 const validPriorities = ['low', 'medium', 'high', 'critical'];
 const priorityValue = validPriorities.includes(priority) ? priority : 'medium';

 const task = await prisma.task.create({
 data: {
 title: title.trim(),
 description: description?.trim() || null,
 priority: priorityValue,
 status: status || 'backlog',
 teamId: teamId || req.body.teamId,
 assigneeId: assigneeId || null,
 agentId: agentId || null,
 branch: branch?.trim() || null,
 dependencies: JSON.stringify(Array.isArray(dependencies) ? dependencies : []),
 },
 include: {
 assignee: { select: { id: true, name: true, type: true } },
 agent: { select: { id: true, name: true, type: true, model: true } },
 },
 });

 res.status(201).json(task);
 } catch (err) {
 console.error('[Create Task]', err);
 res.status(500).json({ error: err.message });
 }
});

// ─── Update a task ────────────────────────────────────────────────────────────
router.put('/:id', withAuth, validate(updateTaskSchema), async (req, res) => {
 try {
 const { title, description, priority, status, assigneeId, agentId, branch, prNumber, dependencies } = req.body;

 const validStatuses = ['backlog', 'in_progress', 'review', 'done'];
 const validPriorities = ['low', 'medium', 'high', 'critical'];
 const data = {};
 if (title !== undefined) data.title = title.trim();
 if (description !== undefined) data.description = description?.trim() || null;
 if (priority !== undefined && validPriorities.includes(priority)) data.priority = priority;
 if (status !== undefined && validStatuses.includes(status)) data.status = status;
 if (assigneeId !== undefined) data.assigneeId = assigneeId;
 if (agentId !== undefined) data.agentId = agentId;
 if (branch !== undefined) data.branch = branch?.trim() || null;
 if (prNumber !== undefined) data.prNumber = prNumber;
 if (dependencies !== undefined) data.dependencies = JSON.stringify(Array.isArray(dependencies) ? dependencies : []);

 const task = await prisma.task.update({
 where: { id: req.params.id },
 data,
 include: {
 assignee: { select: { id: true, name: true, type: true } },
 agent: { select: { id: true, name: true, type: true, model: true } },
 team: { select: { id: true, name: true } },
 },
 });

 broadcastTaskUpdate(task);

 res.json(task);
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
 res.status(500).json({ error: err.message });
 }
});

// ─── Delete a task ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
 try {
 await prisma.task.delete({ where: { id: req.params.id } });
 res.status(204).end();
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
 res.status(500).json({ error: err.message });
 }
});

// ─── Assign task to a member ──────────────────────────────────────────────────
router.post('/:id/assign', async (req, res) => {
 try {
 const { memberId, agentId } = req.body;

 const data = {};
 if (memberId !== undefined) data.assigneeId = memberId;
 if (agentId !== undefined) data.agentId = agentId;

 const task = await prisma.task.update({
 where: { id: req.params.id },
 data,
 include: {
 assignee: { select: { id: true, name: true, type: true } },
 agent: { select: { id: true, name: true, type: true } },
 },
 });

 broadcastTaskUpdate(task);

 res.json(task);
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Task not found' });
 res.status(500).json({ error: err.message });
 }
});

module.exports = router;
