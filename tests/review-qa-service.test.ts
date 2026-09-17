jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    task: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    executionRun: {
      findUnique: jest.fn(),
    },
    activity: {
      create: jest.fn(),
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
  runQA,
  recordQAResult,
  getPendingQA,
} from '../lib/review/qa-service';

beforeEach(() => {
  jest.clearAllMocks();
});

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Build API',
  description: 'Build the REST API',
  status: 'review',
  projectId: 'project-1',
  teamId: 'team-1',
  acceptanceCriteria: 'All endpoints return 200',
  ...overrides,
});

describe('qa-service', () => {
  describe('runQA', () => {
    it('QA passes for successful execution with acceptance criteria met', async () => {
      const task = makeTask({ id: 'task-1', status: 'review' });
      prisma.task.findUnique.mockResolvedValue(task);

      const result = await runQA('task-1', prisma);

      expect(result.passed).toBe(true);
      expect(result.checks.length).toBeGreaterThan(0);
      expect(result.checks.every((c: any) => c.passed)).toBe(true);
    });

    it('QA fails when acceptance criteria not met', async () => {
      const task = makeTask({
        id: 'task-2',
        status: 'review',
        acceptanceCriteria: null,
      });
      prisma.task.findUnique.mockResolvedValue(task);

      const result = await runQA('task-2', prisma);

      expect(result.passed).toBe(false);
      expect(result.checks.some((c: any) => !c.passed)).toBe(true);
    });

    it('QA fails when task is not in review status', async () => {
      const task = makeTask({ id: 'task-3', status: 'in_progress' });
      prisma.task.findUnique.mockResolvedValue(task);

      const result = await runQA('task-3', prisma);

      expect(result.passed).toBe(false);
    });
  });

  describe('recordQAResult', () => {
    it('records result', async () => {
      prisma.task.update.mockResolvedValue({});
      prisma.activity.create.mockResolvedValue({});

      const result = await recordQAResult('task-1', {
        passed: true,
        checks: [{ name: 'Build', passed: true, detail: 'OK' }],
      }, 'agent-qa-1', prisma);

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: 'done' }),
        }),
      );
      expect(prisma.activity.create).toHaveBeenCalled();
      expect(result.passed).toBe(true);
    });
  });

  describe('getPendingQA', () => {
    it('finds tasks awaiting review', async () => {
      const tasks = [
        makeTask({ id: 'task-1', status: 'review' }),
        makeTask({ id: 'task-2', status: 'review' }),
        makeTask({ id: 'task-3', status: 'done' }),
      ];
      prisma.task.findMany.mockResolvedValue([
        tasks[0],
        tasks[1],
      ]);

      const result = await getPendingQA('project-1', prisma);

      expect(result).toHaveLength(2);
      expect(result.every((t: any) => t.status === 'review')).toBe(true);
    });

    it('returns empty array when no tasks awaiting review', async () => {
      prisma.task.findMany.mockResolvedValue([]);

      const result = await getPendingQA('project-1', prisma);

      expect(result).toEqual([]);
    });
  });
});
