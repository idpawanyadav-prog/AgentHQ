// ─── Task Validation Helpers ─────────────────────────────────────────────────
// Centralized validation utilities for Task API endpoints so the same rules
// apply regardless of which route the request comes through.

export const VALID_TASK_STATUSES = [
 'backlog',
 'ready',
 'in_progress',
 'review',
 'testing',
 'done',
 'blocked',
] as const;

export type TaskStatusValue = (typeof VALID_TASK_STATUSES)[number];

export const VALID_TASK_PRIORITIES = [
 'low',
 'medium',
 'high',
 'critical',
] as const;

export type TaskPriorityValue = (typeof VALID_TASK_PRIORITIES)[number];

// Allowed forward transitions. 'blocked' is special-cased below because it
// can be entered from any active state.
const FORWARD_TRANSITIONS: Record<TaskStatusValue, TaskStatusValue[]> = {
 backlog: ['ready'],
 ready: ['in_progress'],
 in_progress: ['review', 'testing'],
 review: ['in_progress', 'testing', 'done'],
 testing: ['in_progress', 'review', 'done'],
 done: [], // done is terminal
 blocked: ['backlog', 'ready', 'in_progress', 'review', 'testing'],
};

/**
 * Returns true when a task is allowed to move from `from` to `to`.
 * Blocked can be entered from any non-terminal state.
 */
export function isValidStatusTransition(
 from: TaskStatusValue,
 to: TaskStatusValue,
): boolean {
 if (from === to) return true; // no-op transitions are always allowed
 if (to === 'blocked') {
 // Blocked can be entered from any active state (everything except done).
 return from !== 'done';
 }
 if (from === 'blocked') {
 // Unblocking lands the task back into an active status.
 return FORWARD_TRANSITIONS.blocked.includes(to);
 }
 return (FORWARD_TRANSITIONS[from] ?? []).includes(to);
}

export interface ReadyRequirementInput {
 title?: string | null;
 description?: string | null;
 projectId?: string | null;
 acceptanceCriteria?: unknown[] | null;
}

/**
 * Returns an error string when the task does not satisfy the "ready"
 * requirements, or null when the task may legally enter ready state.
 */
export function hasReadyRequirements(input: ReadyRequirementInput): string | null {
 if (!input.title || !input.title.trim()) {
 return 'Title is required for a task to enter ready state';
 }
 if (!input.description || !input.description.trim()) {
 return 'Description is required for a task to enter ready state';
 }
 if (!input.projectId) {
 return 'projectId is required for a task to enter ready state';
 }
 if (!Array.isArray(input.acceptanceCriteria) || input.acceptanceCriteria.length === 0) {
 return 'At least one acceptance criterion is required for a task to enter ready state';
 }
 return null;
}

export interface ValidatePayloadOptions {
 partial?: boolean; // true for PUT/PATCH updates
}

/**
 * Validates the common create/update payload shape. Returns null on success
 * or a human-readable error message describing the first failure found.
 */
export function validateTaskPayload(
 body: Record<string, unknown>,
 options: ValidatePayloadOptions = {},
): string | null {
 const partial = options.partial ?? false;
 if(body.dueDate && (typeof body.dueDate !== 'string' || !Number.isFinite(new Date(body.dueDate).getTime()))) return 'Invalid due date';

 const isProvided = (v: unknown) => v !== undefined && v !== null;

 // title: required on create, non-empty when provided on update
 if (!partial || isProvided(body.title)) {
 if (!isProvided(body.title)) {
 return 'Title is required';
 }
 if (typeof body.title !== 'string' || !body.title.trim()) {
 return 'Title must be a non-empty string';
 }
 }

 // status: must be valid value when provided
 if (isProvided(body.status)) {
 if (
 typeof body.status !== 'string' ||
 !VALID_TASK_STATUSES.includes(body.status as TaskStatusValue)
 ) {
 return `Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`;
 }
 }

 // priority: must be valid when provided
 if (isProvided(body.priority)) {
 if (
 typeof body.priority !== 'string' ||
 !VALID_TASK_PRIORITIES.includes(body.priority as TaskPriorityValue)
 ) {
 return `Invalid priority. Must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`;
 }
 }

 // blockedReason: required if blocked=true is being set explicitly
 if (body.blocked === true) {
 if (
 typeof body.blockedReason !== 'string' ||
 !body.blockedReason.trim()
 ) {
 return 'blockedReason is required when blocked=true';
 }
 }

 // teamId: required on create (the route enforces this separately)
 if (!partial) {
 if (isProvided(body.teamId) && typeof body.teamId !== 'string') {
 return 'teamId must be a string';
 }
 }

 // storyPoints: numeric when provided
 if (isProvided(body.storyPoints)) {
 if (typeof body.storyPoints !== 'number' || !Number.isFinite(body.storyPoints)) {
 return 'storyPoints must be a number';
 }
 if ((body.storyPoints as number) < 0) {
 return 'storyPoints must be non-negative';
 }
 }

 return null;
}

/**
 * Validates the body for POST /api/tasks/:id/status.
 * Done is allowed only via explicit body.action === 'done' or as the
 * direct `status: 'done'` to make the user intent explicit and prevent
 * accidental auto-completion by other code paths.
 */
export interface StatusChangeInput {
 currentStatus: TaskStatusValue;
 nextStatus: TaskStatusValue;
 blockedReason?: string | null;
 explicit?: boolean; // caller may pass true for the UI's "Mark done" button
}

export function validateStatusChange(
 input: StatusChangeInput,
): string | null {
 const { currentStatus, nextStatus, blockedReason, explicit } = input;

 if (!VALID_TASK_STATUSES.includes(currentStatus)) {
 return `Invalid current status: ${currentStatus}`;
 }
 if (!VALID_TASK_STATUSES.includes(nextStatus)) {
 return `Invalid target status: ${nextStatus}`;
 }

 if (currentStatus === nextStatus) return null;

 // Done must always be an explicit user action — never auto-set by a
 // transition. The dedicated endpoint receives the action via the
 // `explicit` flag (or the route's own action verb); the validation
 // itself just enforces that callers pass `explicit: true` when the
 // target is 'done'.
 if (nextStatus === 'done' && !explicit) {
 return 'Marking a task done requires explicit user action';
 }

 // Blocked must include a reason.
 if (nextStatus === 'blocked' && (!blockedReason || !blockedReason.trim())) {
 return 'blockedReason is required when status is blocked';
 }

 if (!isValidStatusTransition(currentStatus, nextStatus)) {
 return `Invalid status transition: ${currentStatus} → ${nextStatus}`;
 }

 return null;
}

/**
 * Validates the body for POST /api/tasks/:id/assign. We allow unassign by
 * passing empty / null and we accept either a member (assigneeId) or an
 * agent (agentId). At least one of the two must be present in the request.
 */
export function validateAssignPayload(body: Record<string, unknown>): string | null {
 const hasAssignee = 'assigneeId' in body;
 const hasAgent = 'agentId' in body;
 if (!hasAssignee && !hasAgent) {
 return 'assigneeId or agentId must be provided';
 }
 if (hasAssignee && body.assigneeId !== null && typeof body.assigneeId !== 'string') {
  return 'assigneeId must be a string or null';
 }
 if (hasAgent && body.agentId !== null && typeof body.agentId !== 'string') {
 return 'agentId must be a string or null';
 }
 return null;
}
