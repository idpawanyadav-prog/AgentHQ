import { withAuth } from '../../../../lib/auth';
import { NextApiRequest, NextApiResponse } from 'next';
import { PrismaClient } from '@prisma/client';
import { validateAssignPayload } from '../../../../lib/task-validation';

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
 const validationError = validateAssignPayload(req.body ?? {});
 if (validationError) return fail(res, validationError, 400);

 const task = await prisma.task.findUnique({ where: { id } });
 if (!task) return fail(res, 'Task not found', 404);

 const { assigneeId, agentId } = req.body as {
 assigneeId?: string | null;
 agentId?: string | null;
 };

 // Verify referenced records exist. assign without an assigneeId/agentId
 // un-assigns.
 if (assigneeId) {
 const member = await prisma.member.findUnique({ where: { id: assigneeId } });
 if (!member) return fail(res, `Member not found: ${assigneeId}`, 400);
 }
 if (agentId) {
 const agent = await prisma.agent.findUnique({ where: { id: agentId } });
 if (!agent) return fail(res, `Agent not found: ${agentId}`, 400);
 }

 const updated = await prisma.$transaction(async tx => {
 const result = await tx.task.update({
 where: { id },
 data: {
 assigneeId: assigneeId || null,
 agentId: agentId || null,
 },
 include: TASK_INCLUDE,
 });
 await tx.activity.create({data:{teamId:result.teamId,taskId:result.id,type:"task_assigned",description:`Task assigned: ${result.title}`,meta:JSON.stringify({status:result.status,agentId:result.agentId})}});
 return result;
 });

 return ok(res, updated);
 } catch (err) {
 console.error('[Tasks ASSIGN]', err);
 if ((err as any).code === 'P2025') return fail(res, 'Task not found', 404);
 return fail(res, (err as Error).message || 'Failed to assign task', 500);
 }
}

export default withAuth(handler);
