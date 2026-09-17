import { writeDecisionRecord } from './memory-service';

import prisma from '../prisma';

type Db = any; // PrismaClient | TransactionClient

export async function getProjectMemory(db: Db = prisma, projectId: string) {
    return db.projectMemory.findUnique({ where: { projectId } });
}

export async function upsertProjectMemory(db: Db = prisma, projectId: string, data: {
    mission?: string | null;
    productSummary?: string | null;
    architecture?: string | null;
    techStack?: string | null;
    conventions?: string | null;
    currentPhase?: string | null;
    currentGoal?: string | null;
    completedWork?: string | null;
    keyDecisions?: string | null;
    knownRisks?: string | null;
    blockers?: string | null;
    nextActions?: string | null;
    openQuestions?: string | null;
    testStrategy?: string | null;
    releaseNotes?: string | null;
}) {
    const existing = await db.projectMemory.findUnique({ where: { projectId } });
    if (existing) {
        const updateData: Record<string, unknown> = { updatedAt: new Date() };
        if (data.mission !== undefined) updateData.mission = data.mission;
        if (data.productSummary !== undefined) updateData.productSummary = data.productSummary;
        if (data.architecture !== undefined) updateData.architecture = data.architecture;
        if (data.techStack !== undefined) updateData.techStack = data.techStack;
        if (data.conventions !== undefined) updateData.conventions = data.conventions;
        if (data.currentPhase !== undefined) updateData.currentPhase = data.currentPhase;
        if (data.currentGoal !== undefined) updateData.currentGoal = data.currentGoal;
        if (data.completedWork !== undefined) updateData.completedWork = data.completedWork;
        if (data.keyDecisions !== undefined) updateData.keyDecisions = data.keyDecisions;
        if (data.knownRisks !== undefined) updateData.knownRisks = data.knownRisks;
        if (data.blockers !== undefined) updateData.blockers = data.blockers;
        if (data.nextActions !== undefined) updateData.nextActions = data.nextActions;
        if (data.openQuestions !== undefined) updateData.openQuestions = data.openQuestions;
        if (data.testStrategy !== undefined) updateData.testStrategy = data.testStrategy;
        if (data.releaseNotes !== undefined) updateData.releaseNotes = data.releaseNotes;
        return db.projectMemory.update({ where: { projectId }, data: updateData });
    }
    return db.projectMemory.create({
        data: {
            projectId,
            mission: data.mission ?? null,
            productSummary: data.productSummary ?? null,
            architecture: data.architecture ?? null,
            techStack: data.techStack ?? null,
            conventions: data.conventions ?? null,
            currentPhase: data.currentPhase ?? null,
            currentGoal: data.currentGoal ?? null,
            completedWork: data.completedWork ?? null,
            keyDecisions: data.keyDecisions ?? null,
            knownRisks: data.knownRisks ?? null,
            blockers: data.blockers ?? null,
            nextActions: data.nextActions ?? null,
            openQuestions: data.openQuestions ?? null,
            testStrategy: data.testStrategy ?? null,
            releaseNotes: data.releaseNotes ?? null,
        },
    });
}

export async function appendCompletedWork(db: Db = prisma, projectId: string, text: string) {
    const existing = await db.projectMemory.findUnique({ where: { projectId } });
    if (!existing) {
        return db.projectMemory.create({
            data: {
                projectId,
                completedWork: `- ${text}`,
            },
        });
    }
    const appended = existing.completedWork
        ? `${existing.completedWork}\n- ${text}`
        : `- ${text}`;
    return db.projectMemory.update({
        where: { projectId },
        data: { completedWork: appended },
    });
}

export async function addDecision(
    db: Db = prisma,
    projectId: string,
    title: string,
    decision: string,
    rationale?: string | null,
    alternatives?: string | null,
    consequences?: string | null,
    createdByAgentId?: string | null
) {
    await writeDecisionRecord(db, {
        projectId,
        title,
        decision,
        rationale,
        alternatives,
        consequences,
        createdByAgentId,
    });

    const existing = await db.projectMemory.findUnique({ where: { projectId } });
    if (!existing) return null;

    const decisionEntry = `[${title}] ${decision}`;
    const updatedKeyDecisions = existing.keyDecisions
        ? `${existing.keyDecisions}\n- ${decisionEntry}`
        : `- ${decisionEntry}`;

    return db.projectMemory.update({
        where: { projectId },
        data: { keyDecisions: updatedKeyDecisions },
    });
}

export async function getProjectContext(db: Db = prisma, projectId: string) {
    const memory = await getProjectMemory(db, projectId);
    if (!memory) return null;

    const decisions = await db.decisionRecord.findMany({
        where: { projectId, status: 'active' },
        orderBy: { createdAt: 'asc' },
    });

    return {
        memory,
        activeDecisions: decisions.map((d) => ({
            id: d.id,
            title: d.title,
            decision: d.decision,
            rationale: d.rationale,
            status: d.status,
        })),
    };
}
