jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    task: {
      findMany: jest.fn(),
    },
    agent: {
      findMany: jest.fn(),
    },
    sprint: {
      findFirst: jest.fn(),
    },
    projectMemory: {
      findUnique: jest.fn(),
    },
    projectExecutionState: {
      upsert: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    team: {
      findFirst: jest.fn(),
    },
  },
}));

const prisma = jest.requireMock('../lib/prisma').default;

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

import { computeDeliveryState, updateProjectDeliveryState } from '../lib/orchestration/delivery-state';
import type { ProjectDeliveryState } from '../lib/orchestration/delivery-state';

beforeEach(() => {
  jest.clearAllMocks();
});

function mockProject(tasks: any[] = [], agents: any[] = []) {
  prisma.project.findUnique.mockResolvedValue({
    id: 'project-1',
    teamId: 'team-1',
    tasks,
    sprints: [],
    team: { members: [{ agents }] },
  });
}

describe('delivery-state', () => {
  describe('computeDeliveryState', () => {
    it('computes planning phase for empty project', async () => {
      mockProject([]);
      prisma.agent.findMany.mockResolvedValue([]);

      const state = await computeDeliveryState('project-1');

      // Implementation defaults to 'planning' when no tasks
      expect(['discovery', 'planning']).toContain(state.phase);
      expect(state.readyTasks).toBe(0);
    });

    it('computes planning phase when ready tasks exist but no active', async () => {
      mockProject([
        { status: 'ready', blocked: false },
        { status: 'ready', blocked: false },
        { status: 'ready', blocked: false },
      ]);
      prisma.agent.findMany.mockResolvedValue([]);

      const state = await computeDeliveryState('project-1');

      expect(state.phase).toBe('planning');
      expect(state.readyTasks).toBe(3);
    });

    it('computes building phase when active tasks exist', async () => {
      mockProject([
        { status: 'in_progress', blocked: false },
        { status: 'in_progress', blocked: false },
        { status: 'done', blocked: false },
      ]);
      prisma.agent.findMany.mockResolvedValue([
        { id: 'a1', status: 'working' },
        { id: 'a2', status: 'idle' },
      ]);

      const state = await computeDeliveryState('project-1');

      expect(state.phase).toBe('building');
      expect(state.activeTasks).toBe(2);
    });

    it('computes blocked phase when blocked tasks exist and no working agents', async () => {
      mockProject([
        { status: 'blocked', blocked: true },
        { status: 'blocked', blocked: true },
      ]);
      prisma.agent.findMany.mockResolvedValue([]);

      const state = await computeDeliveryState('project-1');

      expect(state.phase).toBe('blocked');
      expect(state.blockedTasks).toBe(2);
    });

    it('computes completed phase when all tasks done', async () => {
      mockProject([
        { status: 'done', blocked: false },
        { status: 'done', blocked: false },
        { status: 'done', blocked: false },
        { status: 'done', blocked: false },
        { status: 'done', blocked: false },
      ]);
      prisma.agent.findMany.mockResolvedValue([]);

      const state = await computeDeliveryState('project-1');

      expect(state.phase).toBe('completed');
      expect(state.completedTasks).toBe(5);
    });

    it('counts correctly for mixed task statuses', async () => {
      mockProject([
        { status: 'backlog', blocked: false },
        { status: 'backlog', blocked: false },
        { status: 'ready', blocked: false },
        { status: 'ready', blocked: false },
        { status: 'ready', blocked: false },
        { status: 'in_progress', blocked: false },
        { status: 'in_progress', blocked: false },
        { status: 'in_progress', blocked: false },
        { status: 'in_progress', blocked: false },
        { status: 'done', blocked: false },
        { status: 'blocked', blocked: true },
      ]);
      prisma.agent.findMany.mockResolvedValue([]);

      const state = await computeDeliveryState('project-1');

      expect(state.readyTasks).toBe(3);
      expect(state.activeTasks).toBe(4);
      expect(state.completedTasks).toBe(1);
      expect(state.blockedTasks).toBe(1);
    });
  });

  describe('updateProjectDeliveryState', () => {
    it('persists state to ProjectExecutionState', async () => {
      mockProject([]);
      prisma.agent.findMany.mockResolvedValue([]);
      prisma.projectExecutionState.upsert.mockResolvedValue({});

      const result = await updateProjectDeliveryState('project-1');

      expect(prisma.projectExecutionState.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { projectId: 'project-1' },
        })
      );
      expect(['discovery', 'planning']).toContain(result.phase);
    });
  });
});
