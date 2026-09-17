import prismaMock from '../mocks/prisma-mock';
import * as handoffSvc from '../../lib/memory/handoff-service';

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));

describe('Handoff Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.handoffRecord.findMany.mockReset();
        prismaMock.handoffRecord.findUnique.mockReset();
        prismaMock.handoffRecord.create.mockReset();
        prismaMock.handoffRecord.update.mockReset();
    });

    it('creates a handoff', async () => {
        prismaMock.handoffRecord.create.mockResolvedValue({
            id: 'ho1',
            projectId: 'proj1',
            type: 'developer_to_reviewer',
            summary: 'Code review requested',
            consumedAt: null,
        });

        const result = await handoffSvc.createHandoff(prismaMock, {
            projectId: 'proj1',
            type: 'developer_to_reviewer',
            summary: 'Code review requested',
        });

        expect(prismaMock.handoffRecord.create).toHaveBeenCalledTimes(1);
        expect(result.type).toBe('developer_to_reviewer');
    });

    it('gets pending handoffs', async () => {
        prismaMock.handoffRecord.findMany.mockResolvedValue([
            { id: 'ho1', toAgentId: 'agent1', consumedAt: null, summary: 'Review' },
            { id: 'ho2', toAgentId: 'agent1', consumedAt: null, summary: 'Fix' },
        ]);

        const result = await handoffSvc.getPendingHandoffs(prismaMock, 'agent1');

        expect(prismaMock.handoffRecord.findMany).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(2);
    });

    it('gets pending handoffs without agent filter', async () => {
        prismaMock.handoffRecord.findMany.mockResolvedValue([
            { id: 'ho1', consumedAt: null },
        ]);

        const result = await handoffSvc.getPendingHandoffs(prismaMock);

        expect(result).toHaveLength(1);
    });

    it('consumes a handoff', async () => {
        prismaMock.handoffRecord.update.mockResolvedValue({
            id: 'ho1',
            consumedAt: new Date(),
        });

        const result = await handoffSvc.consumeHandoff(prismaMock, 'ho1');

        expect(prismaMock.handoffRecord.update).toHaveBeenCalledTimes(1);
        expect(result.consumedAt).toBeDefined();
    });

    it('gets handoff chain', async () => {
        prismaMock.handoffRecord.findMany.mockResolvedValue([
            { id: 'ho1', taskId: 'task1', type: 'task_pause', createdAt: new Date() },
            { id: 'ho2', taskId: 'task1', type: 'task_resume', createdAt: new Date() },
        ]);

        const result = await handoffSvc.getHandoffChain(prismaMock, 'proj1', 'task1');

        expect(prismaMock.handoffRecord.findMany).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(2);
    });
});
