import prismaMock from '../mocks/prisma-mock';
import * as decisionSvc from '../../lib/memory/decision-service';

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));

describe('Decision Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.decisionRecord.findMany.mockReset();
        prismaMock.decisionRecord.findUnique.mockReset();
        prismaMock.decisionRecord.create.mockReset();
        prismaMock.decisionRecord.update.mockReset();
    });

    it('creates a decision', async () => {
        prismaMock.decisionRecord.create.mockResolvedValue({
            id: 'dec1',
            projectId: 'proj1',
            title: 'Use React',
            decision: 'Use React',
            status: 'active',
        });

        const result = await decisionSvc.createDecision(prismaMock, {
            projectId: 'proj1',
            title: 'Use React',
            decision: 'Use React',
        });

        expect(prismaMock.decisionRecord.create).toHaveBeenCalledTimes(1);
        expect(result.title).toBe('Use React');
    });

    it('gets active decisions', async () => {
        prismaMock.decisionRecord.findMany.mockResolvedValue([
            { id: 'dec1', projectId: 'proj1', status: 'active', title: 'Use React', decision: 'Use React' },
            { id: 'dec2', projectId: 'proj1', status: 'active', title: 'Use TS', decision: 'Use TS' },
        ]);

        const result = await decisionSvc.getActiveDecisions(prismaMock, 'proj1');

        expect(prismaMock.decisionRecord.findMany).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(2);
    });

    it('supersedes a decision', async () => {
        const existing = {
            id: 'dec1',
            projectId: 'proj1',
            decision: 'Use Vue',
            status: 'active',
            supersededAt: null,
        };
        prismaMock.decisionRecord.findUnique.mockResolvedValue(existing);
        prismaMock.decisionRecord.update.mockResolvedValue({
            ...existing,
            status: 'superseded',
            decision: 'Use Vue (superseded by: Switch to React)',
            supersededAt: new Date(),
        });

        const result = await decisionSvc.supersedeDecision(prismaMock, 'dec1', 'Switch to React');

        expect(prismaMock.decisionRecord.update).toHaveBeenCalledTimes(1);
        expect(result?.status).toBe('superseded');
    });

    it('returns null when superseding non-existent decision', async () => {
        prismaMock.decisionRecord.findUnique.mockResolvedValue(null);

        const result = await decisionSvc.supersedeDecision(prismaMock, 'nonexistent');

        expect(result).toBeNull();
    });

    it('gets decision history', async () => {
        prismaMock.decisionRecord.findMany.mockResolvedValue([
            { id: 'dec1', projectId: 'proj1', status: 'superseded' },
            { id: 'dec2', projectId: 'proj1', status: 'active' },
        ]);

        const result = await decisionSvc.getDecisionHistory(prismaMock, 'proj1');

        expect(prismaMock.decisionRecord.findMany).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(2);
    });
});
