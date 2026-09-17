import prismaMock from '../mocks/prisma-mock';
import * as taskMemorySvc from '../../lib/memory/task-memory';

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));

describe('Task Memory Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.taskMemory.findUnique.mockReset();
        prismaMock.taskMemory.create.mockReset();
        prismaMock.taskMemory.update.mockReset();
        prismaMock.handoffRecord.findMany.mockReset();
    });

    it('creates a new task memory when none exists', async () => {
        prismaMock.taskMemory.findUnique.mockResolvedValue(null);
        prismaMock.taskMemory.create.mockResolvedValue({
            id: 'tm1',
            taskId: 'task1',
            projectId: 'proj1',
            objective: 'Build feature X',
            version: 1,
        });

        const result = await taskMemorySvc.upsertTaskMemory(prismaMock, 'task1', 'proj1', {
            objective: 'Build feature X',
        });

        expect(prismaMock.taskMemory.create).toHaveBeenCalledTimes(1);
        expect(result.taskId).toBe('task1');
    });

    it('updates existing task memory and increments version', async () => {
        const existing = {
            id: 'tm1',
            taskId: 'task1',
            projectId: 'proj1',
            version: 3,
            objective: 'Build feature X',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        prismaMock.taskMemory.findUnique.mockResolvedValue(existing);
        prismaMock.taskMemory.update.mockResolvedValue({
            ...existing,
            version: 4,
            objective: 'Build feature Y',
        });

        const result = await taskMemorySvc.upsertTaskMemory(prismaMock, 'task1', 'proj1', {
            objective: 'Build feature Y',
        });

        expect(prismaMock.taskMemory.update).toHaveBeenCalledTimes(1);
        const updateCall = prismaMock.taskMemory.update.mock.calls[0][0];
        expect(updateCall.data.version).toBe(4);
        expect(result.version).toBe(4);
    });

    it('records implementation', async () => {
        const existing = {
            id: 'tm1',
            taskId: 'task1',
            projectId: 'proj1',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        prismaMock.taskMemory.findUnique.mockResolvedValue(existing);
        prismaMock.taskMemory.update.mockResolvedValue({
            ...existing,
            filesTouched: 'src/foo.ts',
            commandsRun: 'npm test',
            version: 2,
        });

        await taskMemorySvc.recordImplementation(prismaMock, 'task1', 'proj1', 'src/foo.ts', 'npm test');

        expect(prismaMock.taskMemory.update).toHaveBeenCalledTimes(1);
    });

    it('records validation result', async () => {
        const existing = {
            id: 'tm1',
            taskId: 'task1',
            projectId: 'proj1',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        prismaMock.taskMemory.findUnique.mockResolvedValue(existing);
        prismaMock.taskMemory.update.mockResolvedValue({
            ...existing,
            validation: 'passed',
            version: 2,
        });

        await taskMemorySvc.recordValidationResult(prismaMock, 'task1', 'proj1', 'passed');

        expect(prismaMock.taskMemory.update).toHaveBeenCalledTimes(1);
    });

    it('sets remaining work and next action', async () => {
        const existing = {
            id: 'tm1',
            taskId: 'task1',
            projectId: 'proj1',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        prismaMock.taskMemory.findUnique.mockResolvedValue(existing);
        prismaMock.taskMemory.update.mockResolvedValue({
            ...existing,
            remainingWork: 'implement API',
            nextAction: 'call backend service',
            version: 2,
        });

        await taskMemorySvc.setRemainingWork(prismaMock, 'task1', 'proj1', 'implement API', 'call backend service');

        expect(prismaMock.taskMemory.update).toHaveBeenCalledTimes(1);
    });

    it('returns task context with handoffs', async () => {
        const memory = {
            id: 'tm1',
            taskId: 'task1',
            projectId: 'proj1',
            objective: 'Build X',
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        prismaMock.taskMemory.findUnique.mockResolvedValue(memory);
        prismaMock.handoffRecord.findMany.mockResolvedValue([
            { id: 'h1', type: 'developer_to_reviewer', summary: 'Done', consumedAt: null },
        ]);

        const ctx = await taskMemorySvc.getTaskContext(prismaMock, 'task1');

        expect(ctx?.memory.objective).toBe('Build X');
        expect(ctx?.handoffs).toHaveLength(1);
    });

    it('returns null when task memory missing', async () => {
        prismaMock.taskMemory.findUnique.mockResolvedValue(null);

        const ctx = await taskMemorySvc.getTaskContext(prismaMock, 'task1');

        expect(ctx).toBeNull();
    });

    it('marks last agent', async () => {
        const existing = {
            id: 'tm1',
            taskId: 'task1',
            projectId: 'proj1',
            version: 1,
            createdAt: new Date(),
            updatedAt: new Date(),
        };
        prismaMock.taskMemory.findUnique.mockResolvedValue(existing);
        prismaMock.taskMemory.update.mockResolvedValue({
            ...existing,
            lastAgentId: 'agent1',
            lastExecutionId: 'run1',
            version: 2,
        });

        await taskMemorySvc.markLastAgent(prismaMock, 'task1', 'proj1', 'agent1', 'run1');

        expect(prismaMock.taskMemory.update).toHaveBeenCalledTimes(1);
    });
});
