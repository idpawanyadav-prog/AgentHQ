
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    task: {
      findMany: jest.fn(),
    },
    executionRun: {
      findMany: jest.fn(),
    },
  },
}));
jest.mock('../lib/memory/memory-service', () => ({
  writeProjectMemory: jest.fn(),
  writeTaskMemory: jest.fn(),
  writeAgentMemory: jest.fn(),
  writeDecisionRecord: jest.fn(),
  getTaskMemory: jest.fn(),
  getProjectMemory: jest.fn(),
  readHandoffRecords: jest.fn(),
  createHandoffRecord: jest.fn(),
}));

const prisma = jest.requireMock('../lib/prisma').default;

import {
  getStalledTasks,
  getStalledExecutions,
  detectStalledWork,
} from '../lib/orchestration/stalled-work';

beforeEach(() => {
  jest.clearAllMocks();
});

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Build API',
  status: 'in_progress',
  projectId: 'project-1',
  teamId: 'team-1',
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date(),
  ...overrides,
});

const makeExecutionRun = (overrides: Record<string, unknown> = {}) => ({
  id: 'exec-1',
  projectId: 'project-1',
  taskId: 'task-1',
  agentId: 'agent-1',
  status: 'running',
  heartbeatAt: new Date(),
  createdAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

describe('stalled-work', () => {
  describe('getStalledTasks', () => {
    it('detects stalled tasks', async () => {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const task = makeTask({ id: 'stalled-task', status: 'in_progress', updatedAt: fourHoursAgo });

      prisma.task.findMany.mockResolvedValue([task]);

      const result = await getStalledTasks('project-1', 4, prisma);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('stalled-task');
    });

    it('does not flag recently active tasks', async () => {
      const task = makeTask({ id: 'fresh-task', status: 'in_progress', updatedAt: new Date() });

      prisma.task.findMany.mockResolvedValue([task]);

      const result = await getStalledTasks('project-1', 4, prisma);

      expect(result).toHaveLength(0);
    });

    it('does not flag completed tasks', async () => {
      const task = makeTask({ id: 'done-task', status: 'done', updatedAt: new Date(Date.now() - 100000) });

      prisma.task.findMany.mockResolvedValue([task]);

      const result = await getStalledTasks('project-1', 4, prisma);

      expect(result).toHaveLength(0);
    });
  });

  describe('getStalledExecutions', () => {
    it('detects stalled executions', async () => {
      const staleHeartbeat = new Date(Date.now() - 180000); // 3 minutes ago
      const exec = makeExecutionRun({
        id: 'stalled-exec',
        status: 'running',
        heartbeatAt: staleHeartbeat,
      });

      prisma.executionRun.findMany.mockResolvedValue([exec]);

      const result = await getStalledExecutions('project-1', 60, prisma);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('stalled-exec');
    });

    it('does not flag executions with fresh heartbeats', async () => {
      const exec = makeExecutionRun({
        id: 'fresh-exec',
        status: 'running',
        heartbeatAt: new Date(), // right now
      });

      prisma.executionRun.findMany.mockResolvedValue([exec]);

      const result = await getStalledExecutions('project-1', 60, prisma);

      expect(result).toHaveLength(0);
    });

    it('does not flag completed executions', async () => {
      const exec = makeExecutionRun({
        id: 'done-exec',
        status: 'completed',
        heartbeatAt: new Date(Date.now() - 180000),
      });

      prisma.executionRun.findMany.mockResolvedValue([exec]);

      const result = await getStalledExecutions('project-1', 60, prisma);

      expect(result).toHaveLength(0);
    });
  });

  describe('detectStalledWork', () => {
    it('returns combined report', async () => {
      const fourHoursAgo = new Date(Date.now() - 4 * 60 * 60 * 1000);
      const staleHeartbeat = new Date(Date.now() - 180000);

      prisma.task.findMany.mockResolvedValue([
        makeTask({ id: 'stalled-task', updatedAt: fourHoursAgo }),
      ]);
      prisma.executionRun.findMany.mockResolvedValue([
        makeExecutionRun({ id: 'stalled-exec', status: 'running', heartbeatAt: staleHeartbeat }),
      ]);

      const result = await detectStalledWork('project-1', prisma);

      expect(result.stalledTasks).toHaveLength(1);
      expect(result.stalledExecutions).toHaveLength(1);
    });
  });
});
