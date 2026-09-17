import prisma from '../prisma';
import { writeTaskMemory } from './memory-service';

type Db = any; // PrismaClient | TransactionClient

export async function getTaskMemory(db: Db = prisma, taskId: string) {
    return db.taskMemory.findUnique({ where: { taskId } });
}

export async function upsertTaskMemory(
    db: Db = prisma,
    taskId: string,
    projectId: string,
    data: {
        objective?: string | null;
        context?: string | null;
        investigation?: string | null;
        implementation?: string | null;
        filesTouched?: string | null;
        commandsRun?: string | null;
        validation?: string | null;
        decisions?: string | null;
        blockers?: string | null;
        remainingWork?: string | null;
        nextAction?: string | null;
        lastAgentId?: string | null;
        lastExecutionId?: string | null;
    }
) {
    return writeTaskMemory(db, taskId, projectId, data);
}

export async function recordImplementation(
    db: Db = prisma,
    taskId: string,
    projectId: string,
    filesTouched: string,
    commandsRun?: string
) {
    return writeTaskMemory(db, taskId, projectId, {
        filesTouched,
        commandsRun: commandsRun ?? null,
    });
}

export async function recordValidationResult(db: Db = prisma, taskId: string, projectId: string, validation: string) {
    return writeTaskMemory(db, taskId, projectId, { validation });
}

export async function setRemainingWork(db: Db = prisma, taskId: string, projectId: string, remainingWork: string, nextAction: string) {
    return writeTaskMemory(db, taskId, projectId, {
        remainingWork,
        nextAction,
    });
}

export async function getTaskContext(db: Db = prisma, taskId: string) {
    const memory = await getTaskMemory(db, taskId);
    if (!memory) return null;

    const handoffs = await db.handoffRecord.findMany({
        where: { taskId },
        orderBy: { createdAt: 'asc' },
    });

    return {
        memory,
        handoffs: handoffs.map((h) => ({
            id: h.id,
            type: h.type,
            fromAgentId: h.fromAgentId,
            toAgentId: h.toAgentId,
            summary: h.summary,
            consumedAt: h.consumedAt,
        })),
    };
}

export async function markLastAgent(db: Db = prisma, taskId: string, projectId: string, agentId: string, executionId: string) {
    return writeTaskMemory(db, taskId, projectId, {
        lastAgentId: agentId,
        lastExecutionId: executionId,
    });
}
