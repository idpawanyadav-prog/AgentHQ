import prismaMock from '../mocks/prisma-mock';
import * as agentMemorySvc from '../../lib/memory/agent-memory';

jest.mock('../../lib/prisma', () => ({ __esModule: true, default: prismaMock }));

describe('Agent Memory Service', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        prismaMock.agentMemory.findMany.mockReset();
        prismaMock.agentMemory.create.mockReset();
        prismaMock.agentMemory.update.mockReset();
    });

    it('creates an agent memory entry', async () => {
        prismaMock.agentMemory.create.mockResolvedValue({
            id: 'am1',
            agentId: 'agent1',
            category: 'lesson',
            content: 'Always test first',
            importance: 50,
            createdAt: new Date(),
        });

        const result = await agentMemorySvc.addAgentMemory(prismaMock, {
            agentId: 'agent1',
            category: 'lesson',
            content: 'Always test first',
        });

        expect(prismaMock.agentMemory.create).toHaveBeenCalledTimes(1);
        expect(result.agentId).toBe('agent1');
    });

    it('queries agent memories with filters', async () => {
        prismaMock.agentMemory.findMany.mockResolvedValue([
            { id: 'am1', agentId: 'agent1', scope: 'project', category: 'lesson', content: 'test', createdAt: new Date() },
        ]);

        const result = await agentMemorySvc.getAgentMemories(prismaMock, 'agent1', 'proj1', 'project', 'lesson');

        expect(prismaMock.agentMemory.findMany).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(1);
    });

    it('touches agent memory', async () => {
        prismaMock.agentMemory.update.mockResolvedValue({
            id: 'am1',
            lastUsedAt: new Date(),
        });

        await agentMemorySvc.touchAgentMemory(prismaMock, 'am1');

        expect(prismaMock.agentMemory.update).toHaveBeenCalledTimes(1);
    });

    it('gets global lessons', async () => {
        prismaMock.agentMemory.findMany.mockResolvedValue([
            { id: 'am1', scope: 'global', category: 'lesson', importance: 80, createdAt: new Date() },
        ]);

        const result = await agentMemorySvc.getGlobalLessons(prismaMock, 'agent1', 'lesson');

        expect(prismaMock.agentMemory.findMany).toHaveBeenCalledTimes(1);
        expect(result).toHaveLength(1);
        expect(result[0].scope).toBe('global');
    });

    it('promotes to agent memory', async () => {
        prismaMock.agentMemory.create.mockResolvedValue({
            id: 'am1',
            agentId: 'agent1',
            projectId: 'proj1',
            category: 'lesson',
            content: 'Learn from this',
        });

        await agentMemorySvc.promoteToAgentMemory(prismaMock, 'agent1', 'proj1', 'Learn from this', 'lesson');

        expect(prismaMock.agentMemory.create).toHaveBeenCalledTimes(1);
        const call = prismaMock.agentMemory.create.mock.calls[0][0];
        expect(call.data.scope).toBe('project');
        expect(call.data.sourceType).toBe('promotion');
    });
});
