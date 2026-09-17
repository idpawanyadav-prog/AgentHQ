import prisma from '../prisma';

type Db = any; // PrismaClient | TransactionClient (TransactionClient not exported in this Prisma version)

export async function writeProjectMemory(db: Db, projectId: string, data: {
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
    version?: number;
}) {
    const existing = await db.projectMemory.findUnique({ where: { projectId } });
    if (existing) {
        const updateData: Record<string, unknown> = {
            mission: data.mission ?? existing.mission,
            productSummary: data.productSummary ?? existing.productSummary,
            architecture: data.architecture ?? existing.architecture,
            techStack: data.techStack ?? existing.techStack,
            conventions: data.conventions ?? existing.conventions,
            currentPhase: data.currentPhase ?? existing.currentPhase,
            currentGoal: data.currentGoal ?? existing.currentGoal,
            completedWork: data.completedWork ?? existing.completedWork,
            keyDecisions: data.keyDecisions ?? existing.keyDecisions,
            knownRisks: data.knownRisks ?? existing.knownRisks,
            blockers: data.blockers ?? existing.blockers,
            nextActions: data.nextActions ?? existing.nextActions,
            openQuestions: data.openQuestions ?? existing.openQuestions,
            testStrategy: data.testStrategy ?? existing.testStrategy,
            releaseNotes: data.releaseNotes ?? existing.releaseNotes,
            updatedAt: new Date(),
        };
        if (data.version !== undefined) {
            updateData.version = data.version;
        }
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
            version: data.version ?? 1,
        },
    });
}

export async function writeTaskMemory(db: Db, taskId: string, projectId: string, data: {
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
    version?: number;
}) {
    const existing = await db.taskMemory.findUnique({ where: { taskId } });
    if (existing) {
        const updateData: Record<string, unknown> = {
            objective: data.objective ?? existing.objective,
            context: data.context ?? existing.context,
            investigation: data.investigation ?? existing.investigation,
            implementation: data.implementation ?? existing.implementation,
            filesTouched: data.filesTouched ?? existing.filesTouched,
            commandsRun: data.commandsRun ?? existing.commandsRun,
            validation: data.validation ?? existing.validation,
            decisions: data.decisions ?? existing.decisions,
            blockers: data.blockers ?? existing.blockers,
            remainingWork: data.remainingWork ?? existing.remainingWork,
            nextAction: data.nextAction ?? existing.nextAction,
            lastAgentId: data.lastAgentId ?? existing.lastAgentId,
            lastExecutionId: data.lastExecutionId ?? existing.lastExecutionId,
            updatedAt: new Date(),
        };
        if (data.version !== undefined) {
            updateData.version = data.version;
        } else {
            updateData.version = existing.version + 1;
        }
        return db.taskMemory.update({ where: { taskId }, data: updateData });
    }
    return db.taskMemory.create({
        data: {
            taskId,
            projectId,
            objective: data.objective ?? null,
            context: data.context ?? null,
            investigation: data.investigation ?? null,
            implementation: data.implementation ?? null,
            filesTouched: data.filesTouched ?? null,
            commandsRun: data.commandsRun ?? null,
            validation: data.validation ?? null,
            decisions: data.decisions ?? null,
            blockers: data.blockers ?? null,
            remainingWork: data.remainingWork ?? null,
            nextAction: data.nextAction ?? null,
            lastAgentId: data.lastAgentId ?? null,
            lastExecutionId: data.lastExecutionId ?? null,
            version: data.version ?? 1,
        },
    });
}

export async function writeAgentMemory(db: Db, data: {
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
    return db.agentMemory.create({
        data: {
            agentId: data.agentId,
            projectId: data.projectId ?? null,
            scope: data.scope ?? 'project',
            category: data.category,
            title: data.title ?? null,
            content: data.content,
            importance: data.importance ?? 50,
            confidence: data.confidence ?? null,
            sourceType: data.sourceType ?? null,
            sourceId: data.sourceId ?? null,
        },
    });
}

export async function writeDecisionRecord(db: Db, data: {
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
    return db.decisionRecord.create({
        data: {
            projectId: data.projectId,
            taskId: data.taskId ?? null,
            sprintId: data.sprintId ?? null,
            title: data.title,
            decision: data.decision,
            rationale: data.rationale ?? null,
            alternatives: data.alternatives ?? null,
            consequences: data.consequences ?? null,
            createdByAgentId: data.createdByAgentId ?? null,
        },
    });
}

export async function writeHandoffRecord(db: Db, data: {
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
    return db.handoffRecord.create({
        data: {
            projectId: data.projectId,
            taskId: data.taskId ?? null,
            fromAgentId: data.fromAgentId ?? null,
            toAgentId: data.toAgentId ?? null,
            type: data.type,
            summary: data.summary,
            completedWork: data.completedWork ?? null,
            remainingWork: data.remainingWork ?? null,
            importantFiles: data.importantFiles ?? null,
            decisions: data.decisions ?? null,
            blockers: data.blockers ?? null,
            nextActions: data.nextActions ?? null,
        },
    });
}

export async function writeTaskReview(db: Db, data: {
    projectId: string;
    taskId: string;
    executionRunId?: string | null;
    reviewerAgentId?: string | null;
    status?: string;
    summary?: string | null;
    findings?: string | null;
}) {
    const existing = await db.taskReview.findUnique({ where: { taskId: data.taskId } });
    if (existing) {
        return db.taskReview.update({
            where: { taskId: data.taskId },
            data: {
                projectId: data.projectId,
                executionRunId: data.executionRunId ?? existing.executionRunId,
                reviewerAgentId: data.reviewerAgentId ?? existing.reviewerAgentId,
                status: data.status ?? existing.status,
                summary: data.summary ?? existing.summary,
                findings: data.findings ?? existing.findings,
            },
        });
    }
    return db.taskReview.create({
        data: {
            projectId: data.projectId,
            taskId: data.taskId,
            executionRunId: data.executionRunId ?? null,
            reviewerAgentId: data.reviewerAgentId ?? null,
            status: data.status ?? 'pending',
            summary: data.summary ?? null,
            findings: data.findings ?? null,
        },
    });
}

export async function writeSprintSummary(db: Db, data: {
    sprintId: string;
    projectId: string;
    goal?: string | null;
    completed?: string | null;
    incomplete?: string | null;
    blockers?: string | null;
    decisions?: string | null;
    lessons?: string | null;
    nextSprint?: string | null;
}) {
    const existing = await db.sprintSummary.findUnique({ where: { sprintId: data.sprintId } });
    if (existing) {
        return db.sprintSummary.update({
            where: { sprintId: data.sprintId },
            data: {
                projectId: data.projectId,
                goal: data.goal ?? existing.goal,
                completed: data.completed ?? existing.completed,
                incomplete: data.incomplete ?? existing.incomplete,
                blockers: data.blockers ?? existing.blockers,
                decisions: data.decisions ?? existing.decisions,
                lessons: data.lessons ?? existing.lessons,
                nextSprint: data.nextSprint ?? existing.nextSprint,
                updatedAt: new Date(),
            },
        });
    }
    return db.sprintSummary.create({
        data: {
            sprintId: data.sprintId,
            projectId: data.projectId,
            goal: data.goal ?? null,
            completed: data.completed ?? null,
            incomplete: data.incomplete ?? null,
            blockers: data.blockers ?? null,
            decisions: data.decisions ?? null,
            lessons: data.lessons ?? null,
            nextSprint: data.nextSprint ?? null,
        },
    });
}

export async function writeSprintRetrospective(db: Db, data: {
    sprintId: string;
    projectId: string;
    wentWell?: string | null;
    problems?: string | null;
    lessons?: string | null;
    actions?: string | null;
}) {
    return db.sprintRetrospective.create({
        data: {
            sprintId: data.sprintId,
            projectId: data.projectId,
            wentWell: data.wentWell ?? null,
            problems: data.problems ?? null,
            lessons: data.lessons ?? null,
            actions: data.actions ?? null,
        },
    });
}

export async function updateTaskMemoryAtBoundary(
    db: Db,
    taskId: string,
    boundary: string,
    data: Record<string, unknown>
) {
    const existing = await db.taskMemory.findUnique({ where: { taskId } });
    if (!existing) return null;

    const updateData: Record<string, unknown> = { version: existing.version + 1, updatedAt: new Date() };

    switch (boundary) {
        case 'execution_start':
            updateData.context = data.context ?? existing.context;
            updateData.objective = data.objective ?? existing.objective;
            updateData.lastAgentId = data.agentId ?? existing.lastAgentId;
            updateData.lastExecutionId = data.executionId ?? existing.lastExecutionId;
            break;
        case 'implementation_checkpoint':
            updateData.implementation = data.implementation ?? existing.implementation;
            updateData.filesTouched = data.filesTouched ?? existing.filesTouched;
            updateData.commandsRun = data.commandsRun ?? existing.commandsRun;
            updateData.blockers = data.blockers ?? existing.blockers;
            break;
        case 'pause':
            updateData.remainingWork = data.remainingWork ?? existing.remainingWork;
            updateData.nextAction = data.nextAction ?? existing.nextAction;
            updateData.blockers = data.blockers ?? existing.blockers;
            break;
        case 'execution_complete':
            updateData.validation = data.validation ?? existing.validation;
            updateData.decisions = data.decisions ?? existing.decisions;
            updateData.commandsRun = data.commandsRun ?? existing.commandsRun;
            break;
        case 'task_done':
            updateData.validation = data.validation ?? existing.validation;
            updateData.remainingWork = 'None';
            updateData.nextAction = 'None';
            break;
    }

    return db.taskMemory.update({ where: { taskId }, data: updateData });
}

export async function updateProjectMemoryAtBoundary(
    db: Db,
    projectId: string,
    boundary: string,
    data: Record<string, unknown>
) {
    const existing = await db.projectMemory.findUnique({ where: { projectId } });
    if (!existing) return null;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    switch (boundary) {
        case 'sprint_complete':
            updateData.completedWork = data.completedWork
                ? `${existing.completedWork ?? ''}\n- ${data.completedWork}`.replace(/^(\n-)?$/, '')
                : existing.completedWork;
            updateData.keyDecisions = data.keyDecisions ?? existing.keyDecisions;
            break;
        case 'task_complete':
            updateData.completedWork = data.completedWork
                ? `${existing.completedWork ?? ''}\n- ${data.completedWork}`.replace(/^(\n-)?$/, '')
                : existing.completedWork;
            updateData.currentPhase = data.currentPhase ?? existing.currentPhase;
            break;
        case 'review_complete':
            updateData.knownRisks = data.knownRisks
                ? `${existing.knownRisks ?? ''}\n- ${data.knownRisks}`.replace(/^(\n-)?$/, '')
                : existing.knownRisks;
            break;
        case 'blocked':
            updateData.blockers = data.blockers
                ? `${existing.blockers ?? ''}\n- ${data.blockers}`.replace(/^(\n-)?$/, '')
                : existing.blockers;
            updateData.currentPhase = 'blocked';
            break;
        case 'unblocked':
            updateData.currentPhase = data.currentPhase ?? 'building';
            break;
        case 'planning':
            updateData.mission = data.mission ?? existing.mission;
            updateData.productSummary = data.productSummary ?? existing.productSummary;
            updateData.currentGoal = data.currentGoal ?? existing.currentGoal;
            break;
        case 'next_action':
            updateData.nextActions = data.nextActions ?? existing.nextActions;
            break;
    }

    return db.projectMemory.update({ where: { projectId }, data: updateData });
}

export async function promoteToProjectMemory(db: Db, projectId: string, data: Record<string, unknown>) {
    const existing = await db.projectMemory.findUnique({ where: { projectId } });
    if (!existing) return null;

    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    if (data.completedWork) {
        updateData.completedWork = `${existing.completedWork ?? ''}\n- ${data.completedWork}`.replace(/^(\n-)?$/, '');
    }
    if (data.keyDecisions) {
        updateData.keyDecisions = data.keyDecisions;
    }
    if (data.knownRisks) {
        updateData.knownRisks = `${existing.knownRisks ?? ''}\n- ${data.knownRisks}`.replace(/^(\n-)?$/, '');
    }
    if (data.currentPhase) {
        updateData.currentPhase = data.currentPhase;
    }
    if (data.nextActions) {
        updateData.nextActions = data.nextActions;
    }
    if (data.blockers) {
        updateData.blockers = `${existing.blockers ?? ''}\n- ${data.blockers}`.replace(/^(\n-)?$/, '');
    }
    if (data.openQuestions) {
        updateData.openQuestions = data.openQuestions;
    }

    return db.projectMemory.update({ where: { projectId }, data: updateData });
}

export default prisma;
