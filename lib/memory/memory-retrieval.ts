import prisma from '../prisma';

export type ExecutionMemoryContext = {
    projectSummary: {
        mission: string | null;
        productSummary: string | null;
        architecture: string | null;
        techStack: string | null;
        conventions: string | null;
        currentPhase: string | null;
        currentGoal: string | null;
        completedWork: string | null;
        keyDecisions: string | null;
        knownRisks: string | null;
        blockers: string | null;
        nextActions: string | null;
        openQuestions: string | null;
    } | null;
    taskSummary: {
        objective: string | null;
        context: string | null;
        investigation: string | null;
        implementation: string | null;
        filesTouched: string | null;
        decisions: string | null;
        blockers: string | null;
        remainingWork: string | null;
        nextAction: string | null;
        lastAgentId: string | null;
        version: number;
    } | null;
    relevantDecisions: Array<{
        id: string;
        projectId: string;
        taskId: string | null;
        title: string;
        decision: string;
        rationale: string | null;
        alternatives: string | null;
        consequences: string | null;
        status: string;
        createdAt: Date;
    }>;
    latestCheckpoint: {
        id: string;
        phase: string;
        gitCommit: string | null;
        taskStatus: string | null;
        agentStatus: string | null;
        metadata: string | null;
        createdAt: Date;
    } | null;
    latestHandoff: {
        id: string;
        fromAgentId: string | null;
        toAgentId: string | null;
        type: string;
        summary: string;
        completedWork: string | null;
        remainingWork: string | null;
        nextActions: string | null;
        blockers: string | null;
        createdAt: Date;
    } | null;
    agentMemories: Array<{
        id: string;
        scope: string;
        category: string;
        title: string | null;
        content: string;
        importance: number;
        confidence: number | null;
        createdAt: Date;
    }>;
    previousFailures: Array<{
        id: string;
        status: string;
        outcome: string | null;
        failureReason: string | null;
        resultSummary: string | null;
        createdAt: Date;
    }>;
    importantFiles: string | null;
    nextAction: string | null;
};

function parseJsonSafe<T>(raw: string | null, fallback: T): T {
    if (!raw) return fallback;
    try {
        return JSON.parse(raw) as T;
    } catch {
        return fallback;
    }
}

export async function buildExecutionMemoryContext(params: {
    projectId: string;
    taskId?: string | null;
    agentId?: string | null;
    executionRunId?: string | null;
}): Promise<ExecutionMemoryContext> {
    const { projectId, taskId, agentId, executionRunId } = params;

    const [
        projectMemoryRecord,
        taskMemoryRecord,
        decisionRecords,
        latestCheckpoint,
        latestHandoff,
        agentMemories,
        previousFailures,
        executionRun,
    ] = await Promise.all([
        prisma.projectMemory.findUnique({ where: { projectId } }),
        taskId
            ? prisma.taskMemory.findUnique({ where: { taskId } })
            : Promise.resolve(null),
        prisma.decisionRecord.findMany({
            where: {
                projectId,
                status: 'active',
                ...(taskId ? { OR: [{ taskId }, { taskId: null }] } : {}),
            },
            orderBy: { createdAt: 'asc' },
        }),
        executionRunId
            ? prisma.executionCheckpoint.findFirst({
                  where: { executionRunId },
                  orderBy: { createdAt: 'desc' },
              })
            : Promise.resolve(null),
        prisma.handoffRecord.findFirst({
            where: {
                projectId,
                ...(taskId ? { taskId } : {}),
                consumedAt: null,
            },
            orderBy: { createdAt: 'desc' },
        }),
        agentId
            ? prisma.agentMemory.findMany({
                  where: { agentId, projectId: projectId ?? null },
                  orderBy: { importance: 'desc' },
                  take: 20,
              })
            : Promise.resolve([]),
        executionRunId
            ? prisma.executionRun.findMany({
                  where: { projectId, status: { in: ['failed', 'cancelled'] } },
                  orderBy: { createdAt: 'desc' },
                  take: 10,
              })
            : Promise.resolve([]),
        executionRunId
            ? prisma.executionRun.findUnique({ where: { id: executionRunId } })
            : Promise.resolve(null),
    ]);

    return {
        projectSummary: projectMemoryRecord
            ? {
                  mission: projectMemoryRecord.mission,
                  productSummary: projectMemoryRecord.productSummary,
                  architecture: projectMemoryRecord.architecture,
                  techStack: projectMemoryRecord.techStack,
                  conventions: projectMemoryRecord.conventions,
                  currentPhase: projectMemoryRecord.currentPhase,
                  currentGoal: projectMemoryRecord.currentGoal,
                  completedWork: projectMemoryRecord.completedWork,
                  keyDecisions: projectMemoryRecord.keyDecisions,
                  knownRisks: projectMemoryRecord.knownRisks,
                  blockers: projectMemoryRecord.blockers,
                  nextActions: projectMemoryRecord.nextActions,
                  openQuestions: projectMemoryRecord.openQuestions,
              }
            : null,
        taskSummary: taskMemoryRecord
            ? {
                  objective: taskMemoryRecord.objective,
                  context: taskMemoryRecord.context,
                  investigation: taskMemoryRecord.investigation,
                  implementation: taskMemoryRecord.implementation,
                  filesTouched: taskMemoryRecord.filesTouched,
                  decisions: taskMemoryRecord.decisions,
                  blockers: taskMemoryRecord.blockers,
                  remainingWork: taskMemoryRecord.remainingWork,
                  nextAction: taskMemoryRecord.nextAction,
                  lastAgentId: taskMemoryRecord.lastAgentId,
                  version: taskMemoryRecord.version,
              }
            : null,
        relevantDecisions: decisionRecords.map((d) => ({
            id: d.id,
            projectId: d.projectId,
            taskId: d.taskId,
            title: d.title,
            decision: d.decision,
            rationale: d.rationale,
            alternatives: d.alternatives,
            consequences: d.consequences,
            status: d.status,
            createdAt: d.createdAt,
        })),
        latestCheckpoint: latestCheckpoint
            ? {
                  id: latestCheckpoint.id,
                  phase: latestCheckpoint.phase,
                  gitCommit: latestCheckpoint.gitCommit,
                  taskStatus: latestCheckpoint.taskStatus,
                  agentStatus: latestCheckpoint.agentStatus,
                  metadata: latestCheckpoint.metadata,
                  createdAt: latestCheckpoint.createdAt,
              }
            : null,
        latestHandoff: latestHandoff
            ? {
                  id: latestHandoff.id,
                  fromAgentId: latestHandoff.fromAgentId,
                  toAgentId: latestHandoff.toAgentId,
                  type: latestHandoff.type,
                  summary: latestHandoff.summary,
                  completedWork: latestHandoff.completedWork,
                  remainingWork: latestHandoff.remainingWork,
                  nextActions: latestHandoff.nextActions,
                  blockers: latestHandoff.blockers,
                  createdAt: latestHandoff.createdAt,
              }
            : null,
        agentMemories: agentMemories.map((m) => ({
            id: m.id,
            scope: m.scope,
            category: m.category,
            title: m.title,
            content: m.content,
            importance: m.importance,
            confidence: m.confidence,
            createdAt: m.createdAt,
        })),
        previousFailures: previousFailures.map((f) => ({
            id: f.id,
            status: f.status,
            outcome: f.outcome,
            failureReason: f.failureReason,
            resultSummary: f.resultSummary,
            createdAt: f.createdAt,
        })),
        importantFiles: executionRun?.changedFiles ?? null,
        nextAction: taskMemoryRecord?.nextAction ?? null,
    };
}

export async function getProjectMemory(projectId: string) {
    return prisma.projectMemory.findUnique({ where: { projectId } });
}

export async function getTaskMemory(taskId: string) {
    return prisma.taskMemory.findUnique({ where: { taskId } });
}

export async function getActiveDecisions(projectId: string, taskId?: string | null) {
    return prisma.decisionRecord.findMany({
        where: {
            projectId,
            status: 'active',
            ...(taskId ? { OR: [{ taskId }, { taskId: null }] } : {}),
        },
        orderBy: { createdAt: 'asc' },
    });
}

export async function getLatestCheckpoint(executionRunId: string) {
    return prisma.executionCheckpoint.findFirst({
        where: { executionRunId },
        orderBy: { createdAt: 'desc' },
    });
}

export async function getLatestHandoff(projectId: string, taskId?: string | null) {
    return prisma.handoffRecord.findFirst({
        where: {
            projectId,
            ...(taskId ? { taskId } : {}),
            consumedAt: null,
        },
        orderBy: { createdAt: 'desc' },
    });
}
