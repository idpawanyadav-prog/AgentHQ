import { withAuth } from '../../../lib/auth';
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import {
 VALID_TASK_STATUSES,
 VALID_TASK_PRIORITIES,
 TaskStatusValue,
 TaskPriorityValue,
 validateTaskPayload,
 validateStatusChange,
 isValidStatusTransition,
 hasReadyRequirements,
} from '../../../lib/task-validation';

import prisma from '../../../lib/prisma';

const TASK_INCLUDE = {
 assignee: true,
 agent: { include: { member: true } },
 team: true,
} as const;

type ApiSuccess<T> = { success: true; data: T };
type ApiError = { success: false; error: string };

function ok<T>(res: NextApiResponse, data: T, status = 200) {
 res.status(status).json({ success: true, data } satisfies ApiSuccess<T>);
}

function fail(res: NextApiResponse, error: string, status = 400) {
 res.status(status).json({ success: false, error } satisfies ApiError);
}

function resolveId(req: NextApiRequest): string | null {
 const raw = req.query.id;
 if (typeof raw === 'string' && raw.trim()) return raw.trim();
 if (Array.isArray(raw) && raw.length > 0) return String(raw[0]).trim();
 return null;
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
 const id = resolveId(req);
 if (!id) return fail(res, 'Task id is required', 400);

 switch (req.method) {
 case 'GET':
 return handleGet(req, res, id);
 case 'PUT':
 return handleUpdate(req, res, id);
 case 'DELETE':
 return handleDelete(req, res, id);
 default:
 res.setHeader('Allow', ['GET', 'PUT', 'DELETE']);
 return fail(res, `Method ${req.method} Not Allowed`, 405);
 }
}

// GET /api/tasks/:id
async function handleGet(
 _req: NextApiRequest,
 res: NextApiResponse,
 id: string,
) {
 try {
 const task = await prisma.task.findUnique({
 where: { id },
 include: TASK_INCLUDE,
 });
 if (!task) return fail(res, 'Task not found', 404);
 return ok(res, task);
 } catch (err) {
 console.error('[Tasks GET]', err);
 return fail(res, (err as Error).message || 'Failed to load task', 500);
 }
}

// PUT /api/tasks/:id
async function handleUpdate(
 req: NextApiRequest,
 res: NextApiResponse,
 id: string,
) {
 try {
 const body = (req.body ?? {}) as Record<string, unknown>;

 // Validate the payload (partial = true for updates).
 const validationError = validateTaskPayload(body, { partial: true });
 if (validationError) return fail(res, validationError, 400);

 // Verify task exists before we do anything.
 const existing = await prisma.task.findUnique({ where: { id } });
 if (!existing) return fail(res, 'Task not found', 404);

 const data: any = {};

 if (body.title !== undefined) {
 if (typeof body.title !== 'string' || !body.title.trim()) {
 return fail(res, 'Title must be a non-empty string', 400);
 }
 data.title = body.title.trim();
 }
 if (body.description !== undefined) {
 data.description =
 typeof body.description === 'string'
 ? body.description.trim() || null
 : null;
 }
 if (body.priority !== undefined && typeof body.priority === 'string') {
 if (VALID_TASK_PRIORITIES.includes(body.priority as TaskPriorityValue)) {
 data.priority = body.priority;
 } else {
 return fail(
 res,
 `Invalid priority. Must be one of: ${VALID_TASK_PRIORITIES.join(', ')}`,
 400,
 );
 }
 }
 if (typeof body.assigneeId !== 'undefined') {
 data.assigneeId = typeof body.assigneeId === 'string' ? body.assigneeId || null : null;
 }
 if (typeof body.agentId !== 'undefined') {
 data.agentId = typeof body.agentId === 'string' ? body.agentId || null : null;
 }
 if (body.branch !== undefined) {
 data.branch = typeof body.branch === 'string' ? body.branch.trim() || null : null;
 }
 if (body.prNumber !== undefined) {
 if (typeof body.prNumber === 'number' && Number.isFinite(body.prNumber)) {
 data.prNumber = body.prNumber;
 }
 }
 if (body.dependencies !== undefined) {
 data.dependencies = Array.isArray(body.dependencies)
 ? JSON.stringify(
 body.dependencies.filter((x: unknown) => typeof x === 'string'),
 )
 : '[]';
 }

 // Status change logic.
 if (body.status !== undefined) {
 const nextStatus = String(body.status);
 if (!VALID_TASK_STATUSES.includes(nextStatus as TaskStatusValue)) {
 return fail(
 res,
 `Invalid status. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`,
 400,
 );
 }

 if (nextStatus === 'blocked') {
 const br =
 typeof body.blockedReason === 'string'
 ? body.blockedReason.trim()
 : '';
 if (!br) return fail(res, 'blockedReason is required when status is blocked', 400);
 data.blocked = true;
 data.blockedReason = br;
 } else {
 data.blocked = false;
 data.blockedReason = null;
 }

 if (nextStatus === 'ready') {
 const readyErr = hasReadyRequirements({
 title: data.title ?? existing.title,
 description: data.description ?? existing.description,
 projectId: body.projectId !== undefined ? (body.projectId as string) : existing.projectId,
 acceptanceCriteria: Array.isArray((body as any).acceptanceCriteria)
 ? (body as any).acceptanceCriteria
 : JSON.parse(existing.acceptanceCriteria || '[]'),
 });
 if (readyErr) return fail(res, readyErr, 400);
 }

 // Transition check for everything except no-op.
 if (nextStatus !== existing.status) {
 if (nextStatus === 'done') {
 const transitionErr = validateStatusChange({
 currentStatus: existing.status as TaskStatusValue,
 nextStatus: nextStatus as TaskStatusValue,
 explicit: true,
 });
 if (transitionErr) return fail(res, transitionErr, 400);
 } else if (!isValidStatusTransition(existing.status as TaskStatusValue, nextStatus as TaskStatusValue)) {
 return fail(
 res,
 `Invalid status transition: ${existing.status} → ${nextStatus}`,
 400,
 );
 }
 }

 data.status = nextStatus;
 }

 // Optional extended fields.
 if ((body as any).acceptanceCriteria !== undefined) {
 data.acceptanceCriteria = JSON.stringify(
 Array.isArray((body as any).acceptanceCriteria)
 ? (body as any).acceptanceCriteria.filter((x: any) => typeof x === 'string' || (x && typeof x.text === 'string'))
 : [],
 );
 }
 if ((body as any).projectId !== undefined)
 data.projectId = (body as any).projectId || null;
 if ((body as any).sprintId !== undefined)
 data.sprintId = (body as any).sprintId || null;
 if ((body as any).type !== undefined) data.type = (body as any).type || null;
 if ((body as any).storyPoints !== undefined)
 data.storyPoints = (body as any).storyPoints ?? null;
 if ((body as any).dueDate !== undefined)
 data.dueDate = body.dueDate ? new Date(String(body.dueDate)) : null;

 // Nothing to update — return current task.
 if (Object.keys(data).length === 0) {
 return ok(res, existing);
 }

 const updated = await prisma.$transaction(async tx => {
 const result = await tx.task.update({
 where: { id },
 data,
 include: TASK_INCLUDE,
 });
 await tx.activity.create({data:{teamId:result.teamId,taskId:result.id,type:"task_updated",description:`Task updated: ${result.title}`,meta:JSON.stringify({status:result.status,agentId:result.agentId})}});
 return result;
 });

 return ok(res, updated);
 } catch (err) {
 console.error('[Tasks PUT]', err);
 if ((err as any).code === 'P2025') return fail(res, 'Task not found', 404);
 return fail(res, (err as Error).message || 'Failed to update task', 500);
 }
}

// DELETE /api/tasks/:id
async function handleDelete(
 _req: NextApiRequest,
 res: NextApiResponse,
 id: string,
) {
 try {
 await prisma.task.delete({ where: { id } });
 return ok(res, { message: 'Task deleted' });
 } catch (err) {
 if ((err as any).code === 'P2025') return fail(res, 'Task not found', 404);
 console.error('[Tasks DELETE]', err);
 return fail(res, (err as Error).message || 'Failed to delete task', 500);
 }
}

export default withAuth(handler);
