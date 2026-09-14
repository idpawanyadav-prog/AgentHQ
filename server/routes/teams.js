const express = require('express');
const router = express.Router();
const prisma = require('../prisma');

// All routes are protected — require authenticated user
function withAuth(req, res, next) {
 if (!req.user) return res.status(401).json({ error: 'Authentication required' });
 return next();
}
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
 agent: { select: { id: true, name: true, type: true, model: true } },
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
router.post('/', async (req, res) => {
 try {
 const { name, description, status } = req.body;

 if (!name || !name.trim()) {
 return res.status(400).json({ error: 'Team name is required' });
 }

 const team = await prisma.team.create({
 data: {
 name: name.trim(),
 description: description?.trim() || null,
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
router.put('/:id', async (req, res) => {
 try {
 const { name, description, status } = req.body;

 const team = await prisma.team.update({
 where: { id: req.params.id },
 data: {
 ...(name !== undefined && { name: name.trim() }),
 ...(description !== undefined && { description: description?.trim() || null }),
 ...(status !== undefined && { status }),
 },
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
