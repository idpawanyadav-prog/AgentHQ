import type { TaskReviewRecord } from '../lib/review/review-service';

describe('review-service', () => {
  const {
    createTaskReview,
    approveTaskReview,
    requestChanges,
    getPendingReviews,
    getReviewHistory,
    canSelfApprove,
    recordRepairCycle,
    clearReviewStore,
  } = require('../lib/review/review-service');

  beforeEach(() => {
    jest.clearAllMocks();
    clearReviewStore();
  });

  it('creates review in pending status', async () => {
    const review = await createTaskReview({
      projectId: 'proj-1',
      taskId: 'task-1',
      executionRunId: 'run-1',
      reviewerAgentId: 'agent-reviewer',
    });
    expect(review.status).toBe('pending');
    expect(review.taskId).toBe('task-1');
    expect(review.repairCycleCount).toBe(0);
  });

  it('approve review sets status to approved', async () => {
    const review = await createTaskReview({
      projectId: 'proj-1',
      taskId: 'task-1',
      executionRunId: 'run-1',
      reviewerAgentId: 'agent-reviewer',
    });
    const updated = await approveTaskReview(review.id, 'Looks good', 'No issues found');
    expect(updated?.status).toBe('approved');
    expect(updated?.summary).toBe('Looks good');
    expect(updated?.findings).toBe('No issues found');
    expect(updated?.completedAt).toBeDefined();
  });

  it('request changes sets status to changes_requested', async () => {
    const review = await createTaskReview({
      projectId: 'proj-1',
      taskId: 'task-1',
      executionRunId: 'run-1',
      reviewerAgentId: 'agent-reviewer',
    });
    const updated = await requestChanges(review.id, 'Tests are failing');
    expect(updated?.status).toBe('changes_requested');
    expect(updated?.findings).toBe('Tests are failing');
  });

  it('agent cannot self-approve', () => {
    expect(canSelfApprove('agent-coder', 'task-1')).toBe(false);
    expect(canSelfApprove('agent-reviewer', 'task-1')).toBe(false);
  });

  it('repair loop blocks after 3 cycles', async () => {
    const review = await createTaskReview({
      projectId: 'proj-1',
      taskId: 'task-1',
      executionRunId: 'run-1',
      reviewerAgentId: 'agent-reviewer',
    });
    await recordRepairCycle(review.id, 1);
    await recordRepairCycle(review.id, 2);
    await recordRepairCycle(review.id, 3);
    const updated = await recordRepairCycle(review.id, 4);
    expect(updated?.repairCycleCount).toBe(4);
    expect(updated?.blocked).toBe(true);
  });

  it('getPendingReviews returns pending reviews', async () => {
    const r1 = await createTaskReview({ projectId: 'proj-1', taskId: 't1', reviewerAgentId: 'rev-1' });
    const r2 = await createTaskReview({ projectId: 'proj-2', taskId: 't2', reviewerAgentId: 'rev-2' });
    await approveTaskReview(r2.id, 'ok', 'fine');
    const pending = await getPendingReviews();
    expect(pending.map((r: TaskReviewRecord) => r.id)).toEqual([r1.id]);
  });

  it('getPendingReviews filters by agent', async () => {
    await createTaskReview({ projectId: 'proj-1', taskId: 't1', reviewerAgentId: 'rev-1' });
    await createTaskReview({ projectId: 'proj-1', taskId: 't2', reviewerAgentId: 'rev-2' });
    const pending = await getPendingReviews('rev-1');
    expect(pending).toHaveLength(1);
    expect(pending[0].reviewerAgentId).toBe('rev-1');
  });

  it('getReviewHistory returns all reviews for a task', async () => {
    const r1 = await createTaskReview({ projectId: 'proj-1', taskId: 't1', reviewerAgentId: 'rev-1' });
    await createTaskReview({ projectId: 'proj-2', taskId: 't2', reviewerAgentId: 'rev-2' });
    const history = await getReviewHistory('t1');
    expect(history).toHaveLength(1);
    expect(history[0].id).toBe(r1.id);
  });
});
