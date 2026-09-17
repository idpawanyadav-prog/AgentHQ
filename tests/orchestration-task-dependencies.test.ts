
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    task: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    agent: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    projectIssue: { create: jest.fn(), createMany: jest.fn(() => Promise.resolve({ count: 0 })) },
    project: { findUnique: jest.fn() },
    sprint: { findFirst: jest.fn() },
    activity: { create: jest.fn() },
    executionRun: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
    executionCheckpoint: { create: jest.fn() },
    job: { create: jest.fn() },
    team: { findFirst: jest.fn(), findMany: jest.fn() },
    agentRoleAssignment: { findMany: jest.fn() },
    projectMemory: { findUnique: jest.fn() },
    projectExecutionState: { upsert: jest.fn(), findUnique: jest.fn() },
    $transaction: jest.fn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
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
  getReadyTasks,
  getDependencyChain,
  detectDependencyCycles,
  calculateReadyTasks,
  isDefinitionOfReady,
} from '../lib/orchestration/task-dependencies';

beforeEach(() => {
  jest.clearAllMocks();
  prisma.task.update.mockReset();
  prisma.task.findMany.mockReset();
  prisma.task.findUnique.mockReset();
  prisma.projectIssue.create.mockReset();
  prisma.projectIssue.createMany.mockReset();
  prisma.task.update.mockResolvedValue({});
  prisma.task.findMany.mockResolvedValue([]);
  prisma.projectIssue.create.mockResolvedValue({});
  prisma.projectIssue.createMany.mockResolvedValue({ count: 0 });
});

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Build API',
  description: 'Build the REST API',
  type: 'task',
  priority: 'medium',
  status: 'backlog',
  projectId: 'project-1',
  teamId: 'team-1',
  dependencies: '[]',
  blocked: false,
  blockedReason: null,
  acceptanceCriteria: 'All endpoints return 200',
  sprintId: null,
  assigneeId: null,
  agentId: null,
  branch: null,
  prNumber: null,
  storyPoints: 5,
  dueDate: null,
  createdAt: new Date('2024-01-01T00:00:00Z'),
  updatedAt: new Date('2024-01-01T00:00:00Z'),
  ...overrides,
});

describe('task-dependencies', () => {
  describe('isDefinitionOfReady', () => {
    it('returns true for complete task', () => {
      expect(isDefinitionOfReady(makeTask())).toBe(true);
    });

    it('returns false for incomplete task missing title', () => {
      expect(isDefinitionOfReady(makeTask({ title: '' }))).toBe(false);
    });

    it('returns false for incomplete task missing description', () => {
      expect(isDefinitionOfReady(makeTask({ description: '' }))).toBe(false);
    });

    it('returns false for task missing acceptance criteria', () => {
      expect(isDefinitionOfReady(makeTask({ acceptanceCriteria: '' }))).toBe(false);
    });
  });

  describe('getReadyTasks', () => {
    it('returns ready tasks with no dependencies and required fields', async () => {
      const task = makeTask({ id: 'task-1', status: 'backlog' });
      prisma.task.findMany.mockResolvedValue([task]);

      const result = await getReadyTasks('project-1');

      expect(result).toHaveLength(1);
      expect(result[0].title).toBe('Build API');
    });

    it('returns empty array when no backlog tasks', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      const result = await getReadyTasks('project-1');
      expect(result).toEqual([]);
    });

    it('excludes tasks blocked by unsatisfied dependencies', async () => {
      const task = makeTask({ id: 'task-1', status: 'backlog', dependencies: JSON.stringify(['dep-1']) });
      const depTask = makeTask({ id: 'dep-1', status: 'in_progress' });
      let calls = 0;
      prisma.task.findMany.mockImplementation(() => {
        calls++;
        return calls === 1 ? [task] : [depTask];
      });

      const result = await getReadyTasks('project-1');
      expect(result).toHaveLength(0);
    });

    it('returns ready tasks with satisfied dependencies', async () => {
      const task = makeTask({ id: 'task-1', status: 'backlog', dependencies: JSON.stringify(['dep-1']) });
      let calls = 0;
      prisma.task.findMany.mockImplementation(() => {
        calls++;
        return calls === 1 ? [task] : [];
      });

      const result = await getReadyTasks('project-1');
      expect(result).toHaveLength(1);
    });
  });

  describe('calculateReadyTasks', () => {
    it('promotes backlog to ready when no dependencies', async () => {
      const task = makeTask({ id: 'task-1', status: 'backlog' });
      let calls = 0;
      prisma.task.findMany.mockImplementation(() => {
        calls++;
        return calls === 1 ? [task] : [];
      });

      await calculateReadyTasks('project-1');

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: { status: 'ready' },
        }),
      );
    });

    it('marks tasks blocked when all deps are unsatisfied', async () => {
      const task = makeTask({ id: 'task-1', status: 'backlog', dependencies: JSON.stringify(['dep-1']) });
      const depTask = makeTask({ id: 'dep-1', status: 'in_progress' });
      let calls = 0;
      prisma.task.findMany.mockImplementation(() => {
        calls++;
        return calls === 1 ? [task] : [depTask];
      });

      await calculateReadyTasks('project-1');

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: 'blocked', blocked: true }),
        }),
      );
    });

    it('blocks when deps become blocked', async () => {
      const task = makeTask({ id: 'task-1', status: 'backlog', dependencies: JSON.stringify(['dep-1']) });
      const depTask = makeTask({ id: 'dep-1', status: 'blocked' });
      let calls = 0;
      prisma.task.findMany.mockImplementation(() => {
        calls++;
        return calls === 1 ? [task] : [depTask];
      });

      await calculateReadyTasks('project-1');

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: { status: 'blocked', blocked: true, blockedReason: 'Dependencies not satisfied' },
        }),
      );
    });

    it('handles empty task list', async () => {
      prisma.task.findMany.mockResolvedValue([]);
      await calculateReadyTasks('project-1');
      expect(prisma.task.update).not.toHaveBeenCalled();
    });
  });

  describe('detectDependencyCycles', () => {
    it('detects dependency cycles', async () => {
      const taskA = makeTask({ id: 'task-a', dependencies: JSON.stringify(['task-b']) });
      const taskB = makeTask({ id: 'task-b', dependencies: JSON.stringify(['task-a']) });
      prisma.task.findMany.mockResolvedValue([taskA, taskB]);

      const result: any = await detectDependencyCycles('project-1');

      expect(result.hasCycle).toBe(true);
      expect(result.cycleMembers).toContain('task-a');
    });

    it('creates ProjectIssue records for cycle members', async () => {
      const taskA = makeTask({ id: 'task-a', dependencies: JSON.stringify(['task-b']) });
      const taskB = makeTask({ id: 'task-b', dependencies: JSON.stringify(['task-a']) });
      prisma.task.findMany.mockResolvedValue([taskA, taskB]);

      await detectDependencyCycles('project-1');

      expect(prisma.projectIssue.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            projectId: 'project-1',
            severity: 'high',
            title: 'Dependency cycle detected',
          }),
        }),
      );
    });

    it('returns no cycle for acyclic dependencies', async () => {
      const taskA = makeTask({ id: 'task-a', dependencies: JSON.stringify(['task-b']) });
      const taskB = makeTask({ id: 'task-b', dependencies: '[]' });
      prisma.task.findMany.mockResolvedValue([taskA, taskB]);

      const result: any = await detectDependencyCycles('project-1');

      expect(result.hasCycle).toBe(false);
      expect(result.cycleMembers).toEqual([]);
    });
  });

  describe('getDependencyChain', () => {
    it('returns empty array for task with no deps', async () => {
      prisma.task.findUnique.mockResolvedValue(makeTask({ dependencies: '[]' }));
      const result = await getDependencyChain('task-1');
      expect(result).toEqual([]);
    });

    it('returns deps chain for task with deps', async () => {
      prisma.task.findUnique
        .mockResolvedValueOnce(makeTask({ id: 'task-1', dependencies: JSON.stringify(['dep-1']) }))
        .mockResolvedValueOnce(makeTask({ id: 'dep-1', dependencies: '[]' }));

      const result = await getDependencyChain('task-1');
      expect(result).toContain('dep-1');
    });
  });
});
