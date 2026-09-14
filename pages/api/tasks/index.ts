import { withAuth } from '../../../lib/auth';
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient, Prisma } from '@prisma/client';
import {
 VALID_TASK_STATUSES,
 VALID_TASK_PRIORITIES,
 TaskStatusValue,
 TaskPriorityValue,
 hasReadyRequirements,
 validateTaskPayload,
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

function parseStringOrUndefined(v: unknown): string | undefined {
 if (typeof v !== 'string') return undefined;
 const trimmed = v.trim();
 return trimmed === '' ? undefined : trimmed;
}

function parseStringArray(v: unknown): string[] {
 if (Array.isArray(v)) return v.filter((x) => typeof x === 'string');
 if (typeof v === 'string') {
 try {
 const parsed = JSON.parse(v);
 if (Array.isArray(parsed)) return parsed.filter((x) => typeof x === 'string');
 } catch {
 return v.split(',').map((s) => s.trim()).filter(Boolean);
 }
 }
 return [];
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
 if (req.method === 'GET') return handleList(req, res);
 if (req.method === 'POST') return handleCreate(req, res);
 res.setHeader('Allow', ['GET', 'POST']);
 return fail(res, `Method ${req.method} Not Allowed`, 405);
}

// GET /api/tasks?projectId=&sprintId=&status=&assigneeId=&agentId=&teamId=&search=
async function handleList(req: NextApiRequest, res: NextApiResponse) {
 try {
 const {
 projectId,
 sprintId,
 status,
 assigneeId,
 agentId,
 teamId,
 search,
 } = req.query;

 const where: Prisma.TaskWhereInput = {};

 if (typeof teamId === 'string' && teamId) where.teamId = teamId;
 if (typeof projectId === 'string' && projectId) {
 where.projectId = projectId;
 }
 if (typeof sprintId === 'string' && sprintId) {
 where.sprintId = sprintId;
 }
 if (typeof status === 'string' && status) {
 if (!VALID_TASK_STATUSES.includes(status as TaskStatusValue)) {
 return fail(
 res,
 `Invalid status filter. Must be one of: ${VALID_TASK_STATUSES.join(', ')}`,
 400,
 );
 }
 where.status = status;
 }
 if (typeof assigneeId === 'string' && assigneeId) where.assigneeId = assigneeId;
 if (typeof agentId === 'string' && agentId) where.agentId = agentId;

 if (typeof search === 'string' && search.trim()) {
 const term = search.trim();
 where.OR = [
 { title: { contains: term } },
 { description: { contains: term } },
 ];
 }

 const tasks = await prisma.task.findMany({
 where,
 include: TASK_INCLUDE,
 orderBy: [{ createdAt: 'desc' }],
 });

 return ok(res, { tasks, total: tasks.length });
 } catch (err) {
 console.error('[Tasks LIST]', err);
 return fail(res, (err as Error).message || 'Failed to list tasks', 500);
 }
}

// POST /api/tasks
async function handleCreate(req: NextApiRequest, res: NextApiResponse) {
 try {
 const body = (req.body ?? {}) as Record<string, unknown>;

 const basicError = validateTaskPayload(body, { partial: false });
 if (basicError) return fail(res, basicError, 400);

 const title = String(body.title).trim();
 const description = parseStringOrUndefined(body.description) ?? null;
 const priority =
 typeof body.priority === 'string' && VALID_TASK_PRIORITIES.includes(body.priority as TaskPriorityValue)
 ? body.priority
 : 'medium';
 const status =
 typeof body.status === 'string' && VALID_TASK_STATUSES.includes(body.status as TaskStatusValue)
 ? body.status
 : 'backlog';
 const teamId = typeof body.teamId === 'string' && body.teamId ? body.teamId : null;
 const assigneeId = typeof body.assigneeId === 'string' && body.assigneeId ? body.assigneeId : null;
 const agentId = typeof body.agentId === 'string' && body.agentId ? body.agentId : null;
 const branch = parseStringOrUndefined(body.branch) ?? null;
 const prNumber =
 typeof body.prNumber === 'number' && Number.isFinite(body.prNumber)
 ? body.prNumber
 : null;
 const dependencies = parseStringArray(body.dependencies);
 const acceptanceCriteria = Array.isArray(body.acceptanceCriteria) ? body.acceptanceCriteria.filter((x: any) => typeof x === 'string' || (x && typeof x.text === 'string')) : [];
 const blocked = body.blocked === true;
 const blockedReason =
 typeof body.blockedReason === 'string' ? body.blockedReason.trim() : '';

 if (!teamId) {
 return fail(res, 'teamId is required to create a task', 400);
 }

 // Verify team exists so we don't end up with orphan tasks.
 const team = await prisma.team.findUnique({ where: { id: teamId } });
 if (!team) {
 return fail(res, `Team not found: ${teamId}`, 400);
 }

 // If created directly in 'ready', enforce ready requirements.
 if (status === 'ready') {
 const readyError = hasReadyRequirements({
 title,
 description,
 projectId: body.projectId as string | undefined,
 acceptanceCriteria,
 });
 if (readyError) return fail(res, readyError, 400);
 }

 if (blocked && !blockedReason) {
 return fail(res, 'blockedReason is required when blocked=true', 400);
 }

 const data: any = {
 title,
 description,
 priority,
 status,
 teamId,
 assigneeId,
 agentId,
 branch,
 prNumber,
 dependencies: JSON.stringify(dependencies),
 acceptanceCriteria: JSON.stringify(acceptanceCriteria),
 blocked,
 blockedReason: blocked ? blockedReason : null,
 };

 // Optional extended fields (tolerant of missing schema columns).
 if (typeof body.projectId === 'string') data.projectId = body.projectId || null;
 if (typeof body.sprintId === 'string') data.sprintId = body.sprintId || null;
 if (typeof body.type === 'string') data.type = body.type;
 if (typeof body.storyPoints === 'number') data.storyPoints = body.storyPoints;
 if (typeof body.dueDate === 'string' || body.dueDate instanceof Date) {
 data.dueDate = body.dueDate ? new Date(body.dueDate) : null;
 }

 const task = await prisma.$transaction(async tx => {
 const result = await tx.task.create({
 data,
 include: TASK_INCLUDE,
 });
 await tx.activity.create({data:{teamId:result.teamId,taskId:result.id,type:"task_created",description:`Task created: ${result.title}`,meta:JSON.stringify({status:result.status,agentId:result.agentId})}});
 return result;
 });

 return ok(res, task, 201);
 } catch (err) {
 console.error('[Tasks CREATE]', err);
 return fail(res, (err as Error).message || 'Failed to create task', 500);
 }
}

export default withAuth(handler);
