import {
    writeTaskMemory as svcWriteTaskMemory,
    writeProjectMemory as svcWriteProjectMemory,
    writeAgentMemory as svcWriteAgentMemory,
    writeDecisionRecord as svcWriteDecisionRecord,
    writeHandoffRecord as svcWriteHandoffRecord,
    writeSprintSummary as svcWriteSprintSummary,
} from './memory-service';

type Db = any; // PrismaClient | TransactionClient

export type MemoryEventType =
    | 'task_completed'
    | 'task_failed'
    | 'agent_learned'
    | 'decision_made'
    | 'handoff_created'
    | 'checkpoint_saved'
    | 'sprint_completed';

export type MemoryEvent = {
    type: MemoryEventType;
    projectId: string;
    taskId?: string | null;
    agentId?: string | null;
    sprintId?: string | null;
    title?: string | null;
    content: string;
    decision?: string | null;
    decisions?: string | null;
    rationale?: string | null;
    alternatives?: string | null;
    consequences?: string | null;
    summary?: string | null;
    completedWork?: string | null;
    remainingWork?: string | null;
    fromAgentId?: string | null;
    toAgentId?: string | null;
    handoffType?: string | null;
    filesTouched?: string | null;
    commandsRun?: string | null;
    validation?: string | null;
    failureReason?: string | null;
    blockers?: string | null;
    lessons?: string | null;
    lessonCategory?: string | null;
    checkpointData?: Record<string, unknown>;
    executionId?: string | null;
    metadata?: Record<string, unknown>;
};

export type MemoryClassification = {
    category: string;
    scope: string;
    services: string[];
};

export function classifyMemoryEvent(event: MemoryEvent): MemoryClassification {
    switch (event.type) {
        case 'task_completed':
            return { category: 'lesson', scope: 'project', services: ['taskMemory', 'projectMemory'] };
        case 'task_failed':
            return { category: 'failure', scope: 'project', services: ['taskMemory', 'agentMemory'] };
        case 'agent_learned':
            return { category: event.lessonCategory ?? 'lesson', scope: 'global', services: ['agentMemory'] };
        case 'decision_made':
            return { category: 'lesson', scope: 'project', services: ['decisionRecord', 'taskMemory', 'projectMemory'] };
        case 'handoff_created':
            return { category: 'workflow', scope: 'task', services: ['handoffRecord'] };
        case 'checkpoint_saved':
            return { category: 'workflow', scope: 'task', services: ['taskMemory'] };
        case 'sprint_completed':
            return { category: 'lesson', scope: 'project', services: ['sprintSummary', 'projectMemory'] };
        default:
            return { category: 'lesson', scope: 'project', services: ['taskMemory'] };
    }
}

export async function promoteEvent(db: Db, event: MemoryEvent): Promise<void> {
    const classification = classifyMemoryEvent(event);

    for (const svc of classification.services) {
        switch (svc) {
            case 'taskMemory': {
                const data: Record<string, unknown> = {};
                if (event.taskId) {
                    if (event.type === 'task_completed' || event.type === 'task_failed') {
                        data.validation = event.validation ?? (event.type === 'task_completed' ? 'passed' : 'failed');
                        data.remainingWork = 'None';
                        data.nextAction = 'None';
                    }
                    if (event.filesTouched) data.filesTouched = event.filesTouched;
                    if (event.commandsRun) data.commandsRun = event.commandsRun;
                    if (event.blockers) data.blockers = event.blockers;
                    if (event.title) data.objective = event.title;
                    await svcWriteTaskMemory(db, event.taskId, event.projectId, data);
                }
                break;
            }
            case 'projectMemory': {
                const projectData: Record<string, unknown> = {};
                if (event.type === 'task_completed') {
                    projectData.completedWork = event.completedWork ?? event.title ?? 'Task completed';
                    projectData.currentPhase = 'building';
                }
                if (event.type === 'task_failed') {
                    projectData.knownRisks = event.failureReason ?? 'Task failed';
                    projectData.currentPhase = 'blocked';
                }
                if (event.type === 'sprint_completed') {
                    projectData.completedWork = event.completedWork ?? null;
                    projectData.keyDecisions = event.decisions ?? null;
                }
                if (event.lessons) projectData.releaseNotes = event.lessons;
                await svcWriteProjectMemory(db, event.projectId, projectData);
                break;
            }
            case 'agentMemory': {
                if (event.agentId && event.content) {
                    await svcWriteAgentMemory(db, {
                        agentId: event.agentId,
                        projectId: event.projectId,
                        scope: event.type === 'agent_learned' ? 'global' : 'project',
                        category: classification.category,
                        title: event.title ?? null,
                        content: event.content,
                        sourceType: 'event',
                        sourceId: event.taskId ?? null,
                    });
                }
                break;
            }
            case 'decisionRecord': {
                if (event.taskId && event.decision) {
                    await svcWriteDecisionRecord(db, {
                        projectId: event.projectId,
                        taskId: event.taskId,
                        sprintId: event.sprintId ?? null,
                        title: event.title ?? 'Decision',
                        decision: event.decision,
                        rationale: event.rationale ?? null,
                        alternatives: event.alternatives ?? null,
                        consequences: event.consequences ?? null,
                        createdByAgentId: event.agentId ?? null,
                    });
                }
                break;
            }
            case 'handoffRecord': {
                if (event.summary) {
                    await svcWriteHandoffRecord(db, {
                        projectId: event.projectId,
                        taskId: event.taskId ?? null,
                        fromAgentId: event.fromAgentId ?? null,
                        toAgentId: event.toAgentId ?? null,
                        type: event.handoffType ?? 'task_pause',
                        summary: event.summary,
                        completedWork: event.completedWork ?? null,
                        remainingWork: event.remainingWork ?? null,
                    });
                }
                break;
            }
            case 'sprintSummary': {
                if (event.sprintId) {
                    await svcWriteSprintSummary(db, {
                        sprintId: event.sprintId,
                        projectId: event.projectId,
                        completed: event.completedWork ?? null,
                        lessons: event.lessons ?? null,
                    });
                }
                break;
            }
        }
    }
}
