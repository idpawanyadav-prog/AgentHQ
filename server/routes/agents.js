const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { broadcastAgentStatus } = require('../socket');
const { validate, createAgentSchema, updateAgentSchema, agentStatusSchema } = require('../middleware/validate');

function withAuth(req, res, next) {
 if (!req.user) return res.status(401).json({ error: 'Authentication required' });
 return next();
}
router.use(withAuth);

// ─── List agents ──────────────────────────────────────────────────────────────
router.get('/', async (req, res) => {
 try {
 const { teamId } = req.query;
 const where = {};
 if (teamId) {
 const members = await prisma.member.findMany({
 where: { teamId, type: 'ai' },
 select: { id: true },
 });
 where.memberId = { in: members.map((m) => m.id) };
 }

 const agents = await prisma.agent.findMany({
 where,
 include: {
 member: { select: { id: true, name: true, role: true, teamId: true } },
 },
 orderBy: { createdAt: 'desc' },
 });

 res.json(agents);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// ─── Get a single agent ───────────────────────────────────────────────────────
router.get('/:id', async (req, res) => {
 try {
 const agent = await prisma.agent.findUnique({
 where: { id: req.params.id },
 include: {
 member: { select: { id: true, name: true, role: true, team: { select: { id: true, name: true } } } },
 tasks: { select: { id: true, title: true, status: true, priority: true } },
 },
 });
 if (!agent) return res.status(404).json({ error: 'Agent not found' });
 res.json(agent);
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// ─── Create an agent ──────────────────────────────────────────────────────────
router.post('/', validate(createAgentSchema), async (req, res) => {
 try {
 const { name, type, model, memberId, config, status } = req.body;

 const member = await prisma.member.findUnique({
 where: { id: memberId },
 });
 if (!member) return res.status(404).json({ error: 'Member not found' });

 const agent = await prisma.agent.create({
 data: {
 name: name.trim(),
 type,
 model: model.trim(),
 memberId,
 config: JSON.stringify(config || { temperature: 0.7, maxTokens: 4096, systemPrompt: '' }),
 status: status || 'idle',
 },
 include: {
 member: { select: { id: true, name: true, role: true } },
 },
 });

 res.status(201).json(agent);
 } catch (err) {
 console.error('[Create Agent]', err);
 res.status(500).json({ error: err.message });
 }
});

// ─── Update an agent ──────────────────────────────────────────────────────────
router.put('/:id', validate(updateAgentSchema), async (req, res) => {
 try {
 const { name, model, config, status } = req.body;

 const data = {};
 if (name !== undefined) data.name = name.trim();
 if (model !== undefined) data.model = model.trim();
 if (config !== undefined) data.config = JSON.stringify(config);
 if (status !== undefined) {
 const validStatuses = ['idle', 'working', 'error'];
 if (validStatuses.includes(status)) data.status = status;
 }

 const agent = await prisma.agent.update({
 where: { id: req.params.id },
 data,
 include: {
 member: { select: { id: true, name: true } },
 },
 });

 broadcastAgentStatus(agent);

 res.json(agent);
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Agent not found' });
 res.status(500).json({ error: err.message });
 }
});

// ─── Delete an agent ──────────────────────────────────────────────────────────
router.delete('/:id', async (req, res) => {
 try {
 await prisma.agent.delete({ where: { id: req.params.id } });
 res.status(204).end();
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Agent not found' });
 res.status(500).json({ error: err.message });
 }
});

// ─── Set agent status ─────────────────────────────────────────────────────────
router.post('/:id/status', validate(agentStatusSchema), async (req, res) => {
 try {
 const { status } = req.body;

 const agent = await prisma.agent.update({
 where: { id: req.params.id },
 data: { status },
 include: { member: { select: { id: true, name: true, teamId: true } } },
 });

 broadcastAgentStatus(agent);

 res.json(agent);
 } catch (err) {
 if (err.code === 'P2025') return res.status(404).json({ error: 'Agent not found' });
 res.status(500).json({ error: err.message });
 }
});

module.exports = router;
