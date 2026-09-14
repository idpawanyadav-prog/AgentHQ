const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { broadcastActivity } = require('../socket');
const { withAuth } = require('../middleware/auth');
const { validate, createTeamSchema, updateTeamSchema } = require('../middleware/validate');

// All routes are protected — require authenticated user
router.use(withAuth);

// ─── List all teams ────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
 try {
 const teams = await prisma.team.findMany({
 include: {
 members: true,
 _count: { select: { members: true, tasks: true } },
 },
 orderBy: { createdAt: 'desc' },
 });
 res.json(teams);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// ─── Get a single team ────────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
 try {
 const team = await prisma.team.findUnique({
 where: { id: req.params.id },
 include: {
 members: true,
 tasks: {
 include: {
 assignee: { select: { id: true, name: true, type: true } },
 agent: { select: { id: true, name: true, type: true, model: true, status: true } },
 },
 orderBy: { status: 'asc' },
 },
 project: true,
 },
 });
 if (!team) return res.status(404).json({ error: 'Team not found' });
 res.json(team);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// ─── Create a team ────────────────────────────────────────────────────────────
router.post('/', validate(createTeamSchema), async (req, res) => {
 try {
 const { name, description, status } = req.body;
 const team = await prisma.team.create({
 data: {
 name,
 description: description || null,
 status: status || 'active',
 },
 include: {
 members: true,
 _count: { select: { members: true, tasks: true } },
 },
 });
 res.status(201).json(team);
 } catch (err) {
 console.error('[Create Team]', err);
 res.status(500).json({ error: err.message });
 }
});

// ─── Update a team ────────────────────────────────────────────────────────────
router.put('/:id', validate(updateTeamSchema), async (req, res) => {
 try {
 const team = await prisma.team.update({
 where: { id: req.params.id },
 data: req.body,
 include: {
 members: true,
 _count: { select: { members: true, tasks: true } },
 },
 });
 res.json(team);
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Team not found' });
 res.status(500).json({ error: err.message });
 }
});

// ─── Delete a team ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
 try {
 await prisma.team.delete({ where: { id: req.params.id } });
 res.status(204).end();
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Team not found' });
 res.status(500).json({ error: err.message });
 }
});

module.exports = router;
