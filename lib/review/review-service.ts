export type TaskReviewRecord = {
  id: string;
  projectId: string;
  taskId: string;
  executionRunId?: string;
  reviewerAgentId?: string;
  status: 'pending' | 'approved' | 'changes_requested';
  summary?: string;
  findings?: string;
  repairCycleCount: number;
  blocked: boolean;
  createdAt: Date;
  completedAt?: Date;
};

type TaskReviewInput = {
  projectId: string;
  taskId: string;
  executionRunId?: string;
  reviewerAgentId?: string;
};

const reviewStore = new Map<string, TaskReviewRecord>();
let reviewCounter = 0;

export function clearReviewStore(): void {
  reviewStore.clear();
  reviewCounter = 0;
}

export async function createTaskReview(input: TaskReviewInput): Promise<TaskReviewRecord> {
  const review: TaskReviewRecord = {
    id: `review_${Date.now()}_${++reviewCounter}`,
    projectId: input.projectId,
    taskId: input.taskId,
    executionRunId: input.executionRunId,
    reviewerAgentId: input.reviewerAgentId,
    status: 'pending',
    repairCycleCount: 0,
    blocked: false,
    createdAt: new Date(),
  };
  reviewStore.set(review.id, review);
  return review;
}

export async function approveTaskReview(
  reviewId: string,
  summary: string,
  findings: string
): Promise<TaskReviewRecord | null> {
  const review = reviewStore.get(reviewId);
  if (!review) return null;
  review.status = 'approved';
  review.summary = summary;
  review.findings = findings;
  review.completedAt = new Date();
  reviewStore.set(reviewId, review);
  return review;
}

export async function requestChanges(
  reviewId: string,
  findings: string
): Promise<TaskReviewRecord | null> {
  const review = reviewStore.get(reviewId);
  if (!review) return null;
  review.status = 'changes_requested';
  review.findings = findings;
  review.repairCycleCount += 1;
  review.blocked = review.repairCycleCount >= 3;
  reviewStore.set(reviewId, review);
  return review;
}

export async function getPendingReviews(agentId?: string): Promise<TaskReviewRecord[]> {
  const pending = Array.from(reviewStore.values()).filter((r) => r.status === 'pending');
  if (agentId) {
    return pending.filter((r) => r.reviewerAgentId === agentId || !r.reviewerAgentId);
  }
  return pending;
}

export async function getReviewHistory(taskId: string): Promise<TaskReviewRecord[]> {
  return Array.from(reviewStore.values()).filter((r) => r.taskId === taskId);
}

export function canSelfApprove(agentId: string, taskId: string): boolean {
  return false;
}

export async function recordRepairCycle(reviewId: string, cycleCount: number): Promise<TaskReviewRecord | null> {
  const review = reviewStore.get(reviewId);
  if (!review) return null;
  review.repairCycleCount = cycleCount;
  if (cycleCount >= 3) {
    review.blocked = true;
    review.status = 'changes_requested';
  }
  reviewStore.set(reviewId, review);
  return review;
}
