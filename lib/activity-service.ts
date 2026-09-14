import prisma from './prisma';

/**
 * Shared activity service.
 *
 * All mutation paths in the API should call logActivity rather than
 * writing Activity rows directly. This guarantees every change
 * produces a realtime event and keeps the event schema consistent.
 */
export async function logActivity(params: {
 teamId: string;
 type: string;
 description: string;
 meta?: Record<string, any>;
 memberId?: string;
 taskId?: string;
}) {
 const metaString = JSON.stringify(params.meta ?? {});
 const activity = await prisma.activity.create({
 data: {
 teamId: params.teamId,
 memberId: params.memberId ?? null,
 taskId: params.taskId ?? null,
 type: params.type,
 description: params.description,
 meta: metaString,
 },
 include: {
 member: { select: { id: true, name: true } },
 task: { select: { id: true, title: true } },
 },
 });
 return activity;
}
