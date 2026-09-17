import prismaMock from '../mocks/prisma-mock';
import * as retrievalSvc from '../../lib/memory/memory-retrieval';

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));

describe('Memory Retrieval Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.projectMemory.findUnique.mockReset();
        prismaMock.taskMemory.findUnique.mockReset();
        prismaMock.decisionRecord.findMany.mockReset();
        prismaMock.executionCheckpoint.findFirst.mockReset();
        prismaMock.handoffRecord.findFirst.mockReset();
        prismaMock.agentMemory.findMany.mockReset();
        prismaMock.executionRun.findMany.mockReset();
        prismaMock.executionRun.findUnique.mockReset();
    });

    it('builds full execution memory context', async () => {
        prismaMock.projectMemory.findUnique.mockResolvedValue({
            projectId: 'proj1',
            mission: 'Build app',
            currentPhase: 'building',
            completedWork: '- Auth',
        });
        prismaMock.taskMemory.findUnique.mockResolvedValue({
            taskId: 'task1',
            objective: 'Add login',
            version: 2,
            nextAction: 'Write tests',
        });
        prismaMock.decisionRecord.findMany.mockResolvedValue([
            { id: 'dec1', title: 'Use JWT', decision: 'Use JWT', status: 'active', createdAt: new Date() },
        ]);
        prismaMock.executionCheckpoint.findFirst.mockResolvedValue({
            id: 'cp1',
            phase: 'implementation',
            createdAt: new Date(),
        });
        prismaMock.handoffRecord.findFirst.mockResolvedValue({
            id: 'ho1',
            type: 'developer_to_reviewer',
            summary: 'Ready for review',
            createdAt: new Date(),
        });
        prismaMock.agentMemory.findMany.mockResolvedValue([
            { id: 'am1', scope: 'project', category: 'lesson', importance: 70, createdAt: new Date() },
        ]);
        prismaMock.executionRun.findMany.mockResolvedValue([]);
        prismaMock.executionRun.findUnique.mockResolvedValue({
            id: 'run1',
            changedFiles: 'src/login.ts',
        });

        const ctx = await retrievalSvc.buildExecutionMemoryContext({
            projectId: 'proj1',
            taskId: 'task1',
            agentId: 'agent1',
            executionRunId: 'run1',
        });

        expect(ctx.projectSummary?.mission).toBe('Build app');
        expect(ctx.taskSummary?.objective).toBe('Add login');
        expect(ctx.relevantDecisions).toHaveLength(1);
        expect(ctx.latestCheckpoint?.id).toBe('cp1');
        expect(ctx.latestHandoff?.id).toBe('ho1');
        expect(ctx.agentMemories).toHaveLength(1);
        expect(ctx.previousFailures).toHaveLength(0);
        expect(ctx.importantFiles).toBe('src/login.ts');
        expect(ctx.nextAction).toBe('Write tests');
    });

    it('handles missing records gracefully', async () => {
        prismaMock.projectMemory.findUnique.mockResolvedValue(null);
        prismaMock.taskMemory.findUnique.mockResolvedValue(null);
        prismaMock.decisionRecord.findMany.mockResolvedValue([]);
        prismaMock.executionCheckpoint.findFirst.mockResolvedValue(null);
        prismaMock.handoffRecord.findFirst.mockResolvedValue(null);
        prismaMock.agentMemory.findMany.mockResolvedValue([]);
        prismaMock.executionRun.findMany.mockResolvedValue([]);
        prismaMock.executionRun.findUnique.mockResolvedValue(null);

        const ctx = await retrievalSvc.buildExecutionMemoryContext({
            projectId: 'proj1',
            taskId: 'task1',
            agentId: 'agent1',
        });

        expect(ctx.projectSummary).toBeNull();
        expect(ctx.taskSummary).toBeNull();
        expect(ctx.relevantDecisions).toHaveLength(0);
        expect(ctx.latestCheckpoint).toBeNull();
        expect(ctx.latestHandoff).toBeNull();
        expect(ctx.agentMemories).toHaveLength(0);
        expect(ctx.previousFailures).toHaveLength(0);
        expect(ctx.importantFiles).toBeNull();
        expect(ctx.nextAction).toBeNull();
    });

    it('returns getProjectMemory', async () => {
        prismaMock.projectMemory.findUnique.mockResolvedValue({ projectId: 'proj1' });

        const result = await retrievalSvc.getProjectMemory('proj1');

        expect(result.projectId).toBe('proj1');
    });

    it('returns getTaskMemory', async () => {
        prismaMock.taskMemory.findUnique.mockResolvedValue({ taskId: 'task1' });

        const result = await retrievalSvc.getTaskMemory('task1');

        expect(result.taskId).toBe('task1');
    });

    it('returns getActiveDecisions', async () => {
        prismaMock.decisionRecord.findMany.mockResolvedValue([
            { id: 'dec1', status: 'active' },
        ]);

        const result = await retrievalSvc.getActiveDecisions('proj1', 'task1');

        expect(prismaMock.decisionRecord.findMany).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(1);
    });

    it('returns getLatestCheckpoint', async () => {
        prismaMock.executionCheckpoint.findFirst.mockResolvedValue({ id: 'cp1' });

        const result = await retrievalSvc.getLatestCheckpoint('run1');

        expect(result.id).toBe('cp1');
    });

    it('returns getLatestHandoff', async () => {
        prismaMock.handoffRecord.findFirst.mockResolvedValue({ id: 'ho1' });

        const result = await retrievalSvc.getLatestHandoff('proj1', 'task1');

        expect(result.id).toBe('ho1');
    });
});
