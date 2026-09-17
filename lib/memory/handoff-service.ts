import prisma from '../prisma';
import { writeHandoffRecord } from './memory-service';

type Db = any; // PrismaClient | TransactionClient

export async function createHandoff(db: Db = prisma, data: {
    projectId: string;
    taskId?: string | null;
    fromAgentId?: string | null;
    toAgentId?: string | null;
    type: string;
    summary: string;
    completedWork?: string | null;
    remainingWork?: string | null;
    importantFiles?: string | null;
    decisions?: string | null;
    blockers?: string | null;
    nextActions?: string | null;
}) {
    return writeHandoffRecord(db, data);
}

export async function getPendingHandoffs(db: Db = prisma, agentId?: string | null) {
    return db.handoffRecord.findMany({
        where: {
            consumedAt: null,
            ...(agentId ? { toAgentId: agentId } : {}),
        },
        orderBy: { createdAt: 'asc' },
    });
}

export async function consumeHandoff(db: Db = prisma, handoffId: string) {
    return db.handoffRecord.update({
        where: { id: handoffId },
        data: { consumedAt: new Date() },
    });
}

export async function getHandoffChain(db: Db = prisma, projectId: string, taskId?: string | null) {
    return db.handoffRecord.findMany({
        where: {
            projectId,
            ...(taskId ? { taskId } : {}),
        },
        orderBy: { createdAt: 'asc' },
    });
}
