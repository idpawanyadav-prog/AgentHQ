const express = require('express');
const router = express.Router();
const prisma = require('../prisma');
const { requireAuth } = require('../middleware/auth');
const { getJobQueue } = require('./lib/job-queue');
const { validate, startAgentSchema, jobCancelSchema } = require('../middleware/validate');

router.use(requireAuth);

// POST /api/jobs/agent/:agentId/start — enqueue a new agent run
router.post('/agent/:agentId/start', validate(startAgentSchema), async (req, res) => {
 try {
 const { agentId } = req.params;
 const { taskId } = req.body;
 if (!agentId) return res.status(400).json({ error: 'agentId is required' });
 if (!taskId) return res.status(400).json({ error: 'taskId is required' });

 const team = await prisma.member.findFirst({
 where: { id: { in: (await prisma.agent.findUnique({ where: { id: agentId }, select: { memberId: true } }))?.memberId || '' } },
 select: { teamId: true },
 });
 const teamId = team?.teamId || '';

 const { enqueueJob } = await getJobQueue();
 const job = await enqueueJob({
 agentId,
 taskId,
 teamId,
 config: {},
 model: '',
 provider: 'anthropic',
 messages: [],
 });
 res.status(202).json({ jobId: job.id, status: job.status });
 } catch (err) {
 res.status(400).json({ error: err.message });
 }
});

// POST /api/jobs/:jobId/cancel
router.post('/:jobId/cancel', validate(jobCancelSchema), async (req, res) => {
 try {
 const { cancelJob } = await getJobQueue();
 const ok = await cancelJob(req.params.jobId);
 if (!ok) return res.status(404).json({ error: 'Job not found or already terminal' });
 res.json({ cancelled: true });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// GET /api/jobs/:jobId/status
router.get('/:jobId/status', async (req, res) => {
 try {
 const { getJob } = await getJobQueue();
 const job = await getJob(req.params.jobId);
 if (!job) return res.status(404).json({ error: 'Not found' });
 res.json({ id: job.id, status: job.status, attempts: job.attempts, error: job.error });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// GET /api/jobs/agent/:agentId
router.get('/agent/:agentId', async (req, res) => {
 try {
 const { listJobs } = await getJobQueue();
 const jobs = await listJobs({ agentId: req.params.agentId });
 res.json({ jobs: jobs.slice(0, 20) });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

// POST /api/jobs/agent/:agentId/stop
router.post('/agent/:agentId/stop', async (req, res) => {
 try {
 const agent = await prisma.agent.findUnique({ where: { id: req.params.agentId } });
 if (!agent) return res.status(404).json({ error: 'Agent not found' });

 const { listJobs, cancelJob } = await getJobQueue();
 const openJobs = await listJobs({ agentId: req.params.agentId, status: ['queued', 'running'] });
 for (const j of openJobs) await cancelJob(j.id);

 await prisma.agent.update({ where: { id: req.params.agentId }, data: { status: 'idle' } });
 res.json({ id: req.params.agentId, status: 'idle', cancelled: openJobs.length });
 } catch (err) {
 res.status(500).json({ error: err.message });
 }
});

module.exports = router;
