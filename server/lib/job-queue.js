// ─── JS bridge for TypeScript job-queue ──────────────────────────────────────
// Express routes require() this file; it re-exports the TS module via tsx.

let cached = null;

async function getJobQueue() {
 if (cached) return cached;
 const mod = await import('../../lib/job-queue');
 cached = {
 enqueueJob: mod.enqueueJob,
 getJob: mod.getJob,
 listJobs: mod.listJobs,
 cancelJob: mod.cancelJob,
 heartbeatJob: mod.heartbeatJob,
 recoverStaleJobs: mod.recoverStaleJobs,
 startWorker: mod.startWorker,
 };
 return cached;
}

module.exports = { getJobQueue };
