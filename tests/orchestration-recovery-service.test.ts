jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    task: { findUnique: jest.fn(), update: jest.fn() },
    agent: { update: jest.fn() },
    executionRun: { findMany: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn(), count: jest.fn() },
    executionCheckpoint: { create: jest.fn() },
    workspace: { update: jest.fn() },
    handoffRecord: { create: jest.fn(), findFirst: jest.fn() },
    activity: { create: jest.fn() },
    job: { create: jest.fn() },
    $transaction: jest.fn(async (cb: any) => {
      const tx = {
        executionRun: { update: jest.fn().mockResolvedValue({}) },
        workspace: { update: jest.fn().mockResolvedValue({}) },
        agent: { update: jest.fn().mockResolvedValue({}) },
        task: { update: jest.fn().mockResolvedValue({}) },
        executionCheckpoint: { create: jest.fn().mockResolvedValue({}) },
        activity: { create: jest.fn().mockResolvedValue({}) },
      };
      return cb(tx);
    }),
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

import { recoverInterruptedExecutions, resumeTask } from '../lib/orchestration/recovery-service';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('recovery-service', () => {
  describe('recoverInterruptedExecutions', () => {
    it('detects stale executions with expired heartbeat', async () => {
      const staleRun = {
        id: 'run-1',
        projectId: 'project-1',
        taskId: 'task-1',
        agentId: 'agent-1',
        workspaceId: 'ws-1',
        status: 'running',
        heartbeatAt: new Date(Date.now() - 120_000),
        task: { id: 'task-1', teamId: 'team-1', title: 'Test Task' },
        agent: { id: 'agent-1' },
        workspace: { id: 'ws-1' },
      };
      prisma.executionRun.findMany.mockResolvedValue([staleRun]);

      const result = await recoverInterruptedExecutions('project-1');

      expect(prisma.executionRun.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: expect.objectContaining({ status: 'running' }) }),
      );
      expect(result.recovered.length).toBe(1);
      expect(result.recovered[0]).toBe('run-1');
    });

    it('does not recover when no stale executions exist', async () => {
      prisma.executionRun.findMany.mockResolvedValue([]);

      const result = await recoverInterruptedExecutions('project-1');

      expect(result.recovered).toEqual([]);
    });
  });

  describe('resumeTask', () => {
    it('creates new execution run for paused task', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'paused',
        projectId: 'project-1',
        teamId: 'team-1',
        agentId: 'agent-1',
        title: 'Test Task',
      });
      prisma.executionRun.create.mockResolvedValue({ id: 'new-run-1' });

      const result = await resumeTask('task-1');

      expect(prisma.executionRun.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'queued',
            taskId: 'task-1',
          }),
        }),
      );
      expect(result.id).toBe('new-run-1');
    });

    it('updates task to ready on resume', async () => {
      prisma.task.findUnique.mockResolvedValue({
        id: 'task-1',
        status: 'paused',
        projectId: 'project-1',
        teamId: 'team-1',
        agentId: 'agent-1',
        title: 'Test Task',
      });
      prisma.executionRun.create.mockResolvedValue({ id: 'new-run-1' });

      await resumeTask('task-1');

      expect(prisma.task.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'task-1' },
          data: expect.objectContaining({ status: 'ready' }),
        }),
      );
    });

    it('throws when task does not exist', async () => {
      prisma.task.findUnique.mockResolvedValue(null);

      await expect(resumeTask('task-x')).rejects.toThrow('Task not found');
    });
  });
});
