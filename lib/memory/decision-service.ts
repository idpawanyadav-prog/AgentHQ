import prisma from '../prisma';
import { writeDecisionRecord } from './memory-service';

type Db = any; // PrismaClient | TransactionClient

export async function createDecision(db: Db = prisma, data: {
    projectId: string;
    taskId?: string | null;
    sprintId?: string | null;
    title: string;
    decision: string;
    rationale?: string | null;
    alternatives?: string | null;
    consequences?: string | null;
    createdByAgentId?: string | null;
}) {
    return writeDecisionRecord(db, data);
}

export async function getActiveDecisions(db: Db = prisma, projectId: string, taskId?: string | null) {
    return db.decisionRecord.findMany({
        where: {
            projectId,
            status: 'active',
            ...(taskId ? { OR: [{ taskId }, { taskId: null }] } : {}),
        },
        orderBy: { createdAt: 'asc' },
    });
}

export async function supersedeDecision(db: Db = prisma, decisionId: string, supersededBy?: string | null) {
    const existing = await db.decisionRecord.findUnique({ where: { id: decisionId } });
    if (!existing) return null;
    const updatedDecision = supersededBy
        ? `${existing.decision} (superseded by: ${supersededBy})`
        : existing.decision;
    return db.decisionRecord.update({
        where: { id: decisionId },
        data: {
            status: 'superseded',
            supersededAt: new Date(),
            decision: updatedDecision,
        },
    });
}

export async function getDecisionHistory(db: Db = prisma, projectId: string) {
    return db.decisionRecord.findMany({
        where: { projectId },
        orderBy: { createdAt: 'desc' },
    });
}
