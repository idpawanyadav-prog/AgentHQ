import { getTaskReviewTool } from '../lib/agent-tools/tools/get-task-review';
import { submitReviewTool } from '../lib/agent-tools/tools/submit-review';
import { submitQaResultTool } from '../lib/agent-tools/tools/submit-qa';

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		taskReview: { findUnique: jest.fn() },
		task: { findUnique: jest.fn() },
		executionRun: { findUnique: jest.fn() },
	},
}));

jest.mock('../lib/memory/memory-service', () => ({
	__esModule: true,
	writeTaskReview: jest.fn(() => Promise.resolve({ id: 'review-1', status: 'approved' })),
}));

jest.mock('../lib/proposal-store', () => ({
	__esModule: true,
	recordProposal: jest.fn(() => ({ id: 'proposal-test' })),
}));

import prisma from '../lib/prisma';

describe('Review/QA agent tools', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('get_task_review', () => {
		it('returns task review data', async () => {
			(prisma.taskReview.findUnique as jest.Mock).mockResolvedValue({
				id: 'r1', taskId: 't1', status: 'approved', summary: 'Looks good',
			});

			const result = await getTaskReviewTool.execute({ taskId: 't1' });
			expect(result.ok).toBe(true);
			expect((result.data as any).summary).toBe('Looks good');
		});

		it('returns NO_REVIEW error when none exists', async () => {
			(prisma.taskReview.findUnique as jest.Mock).mockResolvedValue(null);

			const result = await getTaskReviewTool.execute({ taskId: 't-none' });
			expect(result.ok).toBe(false);
			expect((result.error as any)?.code).toBe('NO_REVIEW');
		});
	});

	describe('submit_review', () => {
		it('submits a review', async () => {
			(prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: 't1', projectId: 'p1', title: 'Test Task' });
			(prisma.executionRun.findUnique as jest.Mock).mockResolvedValue({ id: 'run-1', projectId: 'p1' });

			const result = await submitReviewTool.execute({
				taskId: 't1',
				executionRunId: 'run-1',
				status: 'approved',
				summary: 'Good work',
				findings: 'Minor nit: add comments',
			});

			expect(result.ok).toBe(true);
			expect((result.data as any).status).toBe('approved');
			expect((result.data as any).taskId).toBe('t1');
			expect((result.data as any).proposalId).toBeDefined();
			expect((result.data as any).proposalId).toMatch(/^proposal_review_/);
		});

		it('returns error for non-existent task', async () => {
			(prisma.task.findUnique as jest.Mock).mockResolvedValue(null);
			const result = await submitReviewTool.execute({
				taskId: 'bad',
				executionRunId: 'run-1',
				status: 'approved',
			});
			expect(result.ok).toBe(false);
			expect((result.error as any)?.code).toBe('TASK_NOT_FOUND');
		});
	});

	describe('submit_qa_result', () => {
		it('submits a QA passed result', async () => {
			(prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: 't1', projectId: 'p1', title: 'Test Task' });
			(prisma.executionRun.findUnique as jest.Mock).mockResolvedValue({ id: 'run-1', projectId: 'p1' });

			const result = await submitQaResultTool.execute({
				taskId: 't1',
				projectId: 'p1',
				executionRunId: 'run-1',
				status: 'passed',
				findings: 'All tests pass',
			});

			expect(result.ok).toBe(true);
			expect((result.data as any).status).toBe('passed');
			expect((result.data as any).proposalId).toBeDefined();
			expect((result.data as any).proposalId).toMatch(/^proposal_qa_/);
			expect(result.message).toContain('passed');
		});

		it('submits a QA failed result', async () => {
			(prisma.task.findUnique as jest.Mock).mockResolvedValue({ id: 't1', projectId: 'p1', title: 'Test Task' });
			(prisma.executionRun.findUnique as jest.Mock).mockResolvedValue({ id: 'run-1', projectId: 'p1' });

			const result = await submitQaResultTool.execute({
				taskId: 't1',
				projectId: 'p1',
				executionRunId: 'run-1',
				status: 'failed',
				findings: 'Test suite failed',
			});

			expect(result.ok).toBe(true);
			expect((result.data as any).status).toBe('failed');
			expect(result.message).toContain('failed');
		});
	});
});
