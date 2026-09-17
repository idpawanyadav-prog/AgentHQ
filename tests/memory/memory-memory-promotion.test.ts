import prismaMock from '../mocks/prisma-mock';
import * as promotionSvc from '../../lib/memory/memory-promotion';

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));

describe('Memory Promotion Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.projectMemory.findUnique.mockReset();
        prismaMock.projectMemory.create.mockReset();
        prismaMock.projectMemory.update.mockReset();
        prismaMock.taskMemory.findUnique.mockReset();
        prismaMock.taskMemory.create.mockReset();
        prismaMock.taskMemory.update.mockReset();
        prismaMock.agentMemory.create.mockReset();
        prismaMock.decisionRecord.create.mockReset();
        prismaMock.handoffRecord.create.mockReset();
        prismaMock.sprintSummary.create.mockReset();
        prismaMock.sprintSummary.update.mockReset();
    });

    it('classifies task_completed event', async () => {
        const classification = promotionSvc.classifyMemoryEvent({
            type: 'task_completed',
            projectId: 'proj1',
            taskId: 'task1',
            content: 'Done',
        });

        expect(classification.category).toBe('lesson');
        expect(classification.scope).toBe('project');
        expect(classification.services).toEqual(['taskMemory', 'projectMemory']);
    });

    it('classifies task_failed event', async () => {
        const classification = promotionSvc.classifyMemoryEvent({
            type: 'task_failed',
            projectId: 'proj1',
            taskId: 'task1',
            content: 'Failed',
        });

        expect(classification.services).toEqual(['taskMemory', 'agentMemory']);
    });

    it('classifies agent_learned event', async () => {
        const classification = promotionSvc.classifyMemoryEvent({
            type: 'agent_learned',
            projectId: 'proj1',
            agentId: 'agent1',
            content: 'New pattern learned',
            lessonCategory: 'technical_pattern',
        });

        expect(classification.category).toBe('technical_pattern');
        expect(classification.scope).toBe('global');
        expect(classification.services).toEqual(['agentMemory']);
    });

    it('classifies decision_made event', async () => {
        const classification = promotionSvc.classifyMemoryEvent({
            type: 'decision_made',
            projectId: 'proj1',
            taskId: 'task1',
            content: 'Decided on approach',
            decision: 'Use microservices',
        });

        expect(classification.services).toEqual(['decisionRecord', 'taskMemory', 'projectMemory']);
    });

    it('classifies handoff_created event', async () => {
        const classification = promotionSvc.classifyMemoryEvent({
            type: 'handoff_created',
            projectId: 'proj1',
            taskId: 'task1',
            summary: 'Handing off to reviewer',
        });

        expect(classification.services).toEqual(['handoffRecord']);
    });

    it('classifies checkpoint_saved event', async () => {
        const classification = promotionSvc.classifyMemoryEvent({
            type: 'checkpoint_saved',
            projectId: 'proj1',
            taskId: 'task1',
            content: 'Checkpoint',
        });

        expect(classification.services).toEqual(['taskMemory']);
    });

    it('classifies sprint_completed event', async () => {
        const classification = promotionSvc.classifyMemoryEvent({
            type: 'sprint_completed',
            projectId: 'proj1',
            sprintId: 'sprint1',
            content: 'Sprint done',
        });

        expect(classification.services).toEqual(['sprintSummary', 'projectMemory']);
    });

    it('promotes task_completed event', async () => {
        prismaMock.taskMemory.findUnique.mockResolvedValue(null);
        prismaMock.taskMemory.create.mockResolvedValue({ id: 'tm1' });
        prismaMock.projectMemory.findUnique.mockResolvedValue(null);
        prismaMock.projectMemory.create.mockResolvedValue({ id: 'pm1' });

        await promotionSvc.promoteEvent(prismaMock, {
            type: 'task_completed',
            projectId: 'proj1',
            taskId: 'task1',
            title: 'Feature X',
            completedWork: 'Implemented Feature X',
            content: 'Task done',
        });

        expect(prismaMock.taskMemory.create).toHaveBeenCalledTimes(1);
        expect(prismaMock.projectMemory.create).toHaveBeenCalledTimes(1);
    });

    it('promotes agent_learned event', async () => {
        prismaMock.agentMemory.create.mockResolvedValue({ id: 'am1' });

        await promotionSvc.promoteEvent(prismaMock, {
            type: 'agent_learned',
            projectId: 'proj1',
            agentId: 'agent1',
            content: 'Learned to use try-catch',
            lessonCategory: 'technical_pattern',
        });

        expect(prismaMock.agentMemory.create).toHaveBeenCalledTimes(1);
        const call = prismaMock.agentMemory.create.mock.calls[0][0];
        expect(call.data.scope).toBe('global');
    });
});
