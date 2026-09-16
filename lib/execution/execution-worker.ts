import prisma from '../prisma';
import type { JobRecord, JobResult } from '../job-queue';
import { executeRun, recoverStaleExecutionRuns } from './execution-service';

export async function runExecutionJob(job: JobRecord, signal: AbortSignal): Promise<JobResult> {
	const executionRunId = typeof job.payload === 'object' && 'executionRunId' in job.payload ? String(job.payload.executionRunId) : '';
	if (!executionRunId) throw new Error('executionRunId is required');
	if (signal.aborted) throw new Error('Cancelled by user');
	const abort = async () => {
		await prisma.executionRun.updateMany({ where: { id: executionRunId, status: { in: ['queued', 'preparing', 'running'] } }, data: { status: 'cancelled', finishedAt: new Date(), failureReason: 'Cancelled by user' } });
	};
	signal.addEventListener('abort', abort, { once: true });
	try {
		const run = await prisma.executionRun.findUnique({ where: { id: executionRunId } });
		if (!run) throw new Error('ExecutionRun not found');
		await executeRun(executionRunId);
		const completed = await prisma.executionRun.findUnique({ where: { id: executionRunId } });
		return {
			output: completed?.resultSummary || 'Execution completed',
			usage: {
				promptTokens: completed?.inputTokens || 0,
				completionTokens: completed?.outputTokens || 0,
				totalTokens: completed?.totalTokens || 0,
			},
			latencyMs: completed?.startedAt && completed?.finishedAt ? completed.finishedAt.getTime() - completed.startedAt.getTime() : 0,
		};
	} finally {
		signal.removeEventListener('abort', abort);
		await recoverStaleExecutionRuns();
	}
}
