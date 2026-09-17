import prisma from '../prisma';
import { writeAgentMemory } from './memory-service';

type Db = any; // PrismaClient | TransactionClient

export async function addAgentMemory(db: Db = prisma, data: {
    agentId: string;
    projectId?: string | null;
    scope?: string;
    category: string;
    title?: string | null;
    content: string;
    importance?: number;
    confidence?: number | null;
    sourceType?: string | null;
    sourceId?: string | null;
}) {
    return writeAgentMemory(db, data);
}

export async function getAgentMemories(
    db: Db = prisma,
    agentId: string,
    projectId?: string | null,
    scope?: string | null,
    category?: string | null
) {
    return db.agentMemory.findMany({
        where: {
            agentId,
            ...(projectId !== undefined ? { projectId: projectId ?? null } : {}),
            ...(scope ? { scope } : {}),
            ...(category ? { category } : {}),
        },
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
    });
}

export async function touchAgentMemory(db: Db = prisma, id: string) {
    return db.agentMemory.update({
        where: { id },
        data: { lastUsedAt: new Date() },
    });
}

export async function getGlobalLessons(db: Db = prisma, agentId: string, category?: string | null) {
    return db.agentMemory.findMany({
        where: {
            agentId,
            scope: 'global',
            ...(category ? { category } : {}),
        },
        orderBy: [{ importance: 'desc' }, { createdAt: 'desc' }],
    });
}

export async function promoteToAgentMemory(
    db: Db = prisma,
    agentId: string,
    projectId: string,
    content: string,
    category: string
) {
    return writeAgentMemory(db, {
        agentId,
        projectId,
        scope: 'project',
        category,
        title: category,
        content,
        sourceType: 'promotion',
        sourceId: projectId,
    });
}
