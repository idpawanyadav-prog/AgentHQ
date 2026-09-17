jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    task: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    agent: { findMany: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
    job: { create: jest.fn(), update: jest.fn() },
    executionRun: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), count: jest.fn(), update: jest.fn() },
    executionCheckpoint: { create: jest.fn() },
    projectExecutionState: { findUnique: jest.fn(), upsert: jest.fn() },
    activity: { create: jest.fn() },
    project: { findUnique: jest.fn(), findMany: jest.fn() },
    team: { findFirst: jest.fn() },
    sprint: { findFirst: jest.fn() },
    projectMemory: { findUnique: jest.fn() },
    handoffRecord: { create: jest.fn(), findFirst: jest.fn() },
    $transaction: jest.fn(),
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

import { runProjectOrchestrationCycle, triggerOrchestration } from '../lib/orchestration/project-orchestrator';

beforeEach(() => {
  jest.clearAllMocks();
});

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Build API',
  description: 'Build the REST API',
  status: 'backlog',
  type: 'task',
  priority: 'medium',
  projectId: 'project-1',
  teamId: 'team-1',
  requiredRole: undefined,
  storyPoints: 5,
  dependencies: '[]',
  blocked: false,
  agentId: null,
  ...overrides,
});

describe('project-orchestrator', () => {
  describe('runProjectOrchestrationCycle', () => {
    it('runs full orchestration cycle', async () => {
      // No stale executions
      prisma.executionRun.findMany.mockResolvedValue([]);
      // No tasks to start with
      prisma.task.findMany.mockResolvedValue([]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.project.findUnique.mockResolvedValue({ id: 'project-1', tasks: [], team: { members: [] }, sprints: [] });
      prisma.projectExecutionState.upsert.mockResolvedValue({});

      const result = await runProjectOrchestrationCycle('project-1');

      // Verify recovery checked for stale executions
      expect(prisma.executionRun.findMany).toHaveBeenCalled();
      // Verify delivery state was updated
      expect(prisma.projectExecutionState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-1' },
          create: expect.objectContaining({ projectId: 'project-1' }),
          update: expect.any(Object),
        }),
      );
      expect(result).toBeDefined();
    });

    it('handles empty ready tasks — no assignments queued', async () => {
      prisma.executionRun.findMany.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.projectExecutionState.upsert.mockResolvedValue({});

      const result = await runProjectOrchestrationCycle('project-1');

      expect(result).toBeDefined();
      expect(result.ready).toBe(0);
      expect(result.queued).toBe(0);
    });

    it('handles no available agents — no assignments', async () => {
      // Return backlog tasks but no idle agents
      prisma.executionRun.findMany.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([makeTask({ id: 't1', status: 'backlog' })]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.projectExecutionState.upsert.mockResolvedValue({});

      const result = await runProjectOrchestrationCycle('project-1');

      expect(result).toBeDefined();
      expect(result.ready).toBeGreaterThanOrEqual(0);
    });

    it('returns error object when orchestration fails', async () => {
      prisma.executionRun.findMany.mockRejectedValue(new Error('DB connection lost'));

      const result = await runProjectOrchestrationCycle('project-1');

      expect(result).toBeDefined();
      expect((result as any).error).toBeDefined();
      expect((result as any).queued).toBe(0);
    });
  });

  describe('triggerOrchestration', () => {
    it('triggers for specific project', async () => {
      prisma.executionRun.findMany.mockResolvedValue([]);
      prisma.task.findMany.mockResolvedValue([]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.projectExecutionState.upsert.mockResolvedValue({});

      const result = await triggerOrchestration('task_completion', 'project-1');
      expect(typeof result).toBe('object');
      expect(result['project-1']).toBeDefined();
    });
  });
});
