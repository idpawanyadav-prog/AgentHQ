import { withAuth } from '../../../../lib/auth';
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import {
 VALID_TASK_STATUSES,
 TaskStatusValue,
 validateStatusChange,
 hasReadyRequirements,
} from '../../../../lib/task-validation';

import prisma from '../../../../lib/prisma';

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
 if (req.method !== 'POST') {
 res.setHeader('Allow', ['POST']);
 return fail(res, `Method ${req.method} Not Allowed`, 405);
 }

 const id = resolveId(req);
 if (!id) return fail(res, 'Task id is required', 400);

 try {
 const body = (req.body ?? {}) as Record<string, unknown>;

 if (
 typeof body.status !== 'string' ||
 !VALID_TASK_STATUSES.includes(body.status as TaskStatusValue)
 ) {
 return fail(
 res,
 `status is required and must be one of: ${VALID_TASK_STATUSES.join(', ')}`,
 400,
 );
 }

 const task = await prisma.task.findUnique({ where: { id } });
 if (!task) return fail(res, 'Task not found', 404);

 const nextStatus = body.status as string;
 if(nextStatus === 'ready') {
 const readyError=hasReadyRequirements({...task,acceptanceCriteria:JSON.parse(task.acceptanceCriteria || '[]')});
 if(readyError) return fail(res,readyError,400);
 }
 const blockedReason =
 typeof body.blockedReason === 'string' ? body.blockedReason.trim() : undefined;

 const error = validateStatusChange({
 currentStatus: task.status as TaskStatusValue,
 nextStatus: nextStatus as TaskStatusValue,
 blockedReason,
 explicit: true,
 });
 if (error) return fail(res, error, 400);

 const data: any = { status: nextStatus };

 if (nextStatus === 'blocked') {
 data.blocked = true;
 data.blockedReason = blockedReason || null;
 } else {
 data.blocked = false;
 data.blockedReason = null;
 }

 const updated = await prisma.$transaction(async tx => {
 const result = await tx.task.update({
 where: { id },
 data,
 include: TASK_INCLUDE,
 });
 await tx.activity.create({data:{teamId:result.teamId,taskId:result.id,type:"task_moved",description:`Task moved: ${result.title}`,meta:JSON.stringify({status:result.status,agentId:result.agentId})}});
 return result;
 });

 return ok(res, updated);
 } catch (err) {
 console.error('[Tasks STATUS]', err);
 if ((err as any).code === 'P2025') return fail(res, 'Task not found', 404);
 return fail(res, (err as Error).message || 'Failed to change status', 500);
 }
}

export default withAuth(handler);
