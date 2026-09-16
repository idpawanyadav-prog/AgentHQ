require('dotenv').config();
const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { authMiddleware: withAuth } = require('../middleware/auth');

// All routes are protected — require authenticated user
router.use(withAuth);

// ─── Create a member ────────────────────────────────────────────────────────────
router.post('/', async (req, res) => {
 try {
 const { name, role, type, teamId } = req.body;

 // Validate required fields
 if (!name || !role || !type || !teamId) {
 return res.status(400).json({ error: 'Missing required fields: name, role, type, teamId' });
 }

 // Server-side enforcement: human members must be Team Lead
 const enforcedRole = type === 'human' ? 'Team Lead' : role;

 const member = await prisma.member.create({
 data: { name, role: enforcedRole, type, teamId },
 });
 res.status(201).json(member);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// ─── Update a member ────────────────────────────────────────────────────────────
router.put('/:id', async (req, res) => {
 try {
 const { name, role, type, teamId } = req.body;
 const data = {};

 if (name !== undefined) data.name = name;
 if (teamId !== undefined) data.teamId = teamId;

 if (type !== undefined) {
 data.type = type;
 // Server-side enforcement: human members must be Team Lead
 data.role = type === 'human' ? 'Team Lead' : role;
 } else if (role !== undefined) {
 data.role = role;
 }

 const member = await prisma.member.update({
 where: { id: req.params.id },
 data,
 });
 res.json(member);
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Member not found' });
 res.status(500).json({ error: err.message });
 }
});

// ─── Delete a member ────────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
 try {
 await prisma.member.delete({ where: { id: req.params.id } });
 res.status(204).end();
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Member not found' });
 res.status(500).json({ error: err.message });
 }
});

module.exports = router;
