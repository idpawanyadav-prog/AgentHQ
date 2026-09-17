
jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    task: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      updateMany: jest.fn(),
      count: jest.fn(),
    },
    agent: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    team: {
      findFirst: jest.fn(),
    },
    member: {
      findMany: jest.fn(),
    },
    project: {
      findUnique: jest.fn(),
    },
    activity: {
      create: jest.fn(),
    },
    job: {
      create: jest.fn(),
      update: jest.fn(),
    },
    $transaction: jest.fn(async (cb: any) => cb({
      task: { update: jest.fn() },
      agent: { update: jest.fn() },
      job: { create: jest.fn() },
    })),
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

import {
  scoreAgentForTask,
  findBestAgentForTask,
  assignTasksToAgents,
  getAvailableAgents,
  suggestTaskSplit,
} from '../lib/orchestration/assignment-planner';

beforeEach(() => {
  jest.clearAllMocks();
});

const makeAgent = (overrides: Record<string, unknown> = {}) => ({
  id: 'agent-1',
  name: 'Backend Developer #1',
  type: 'anthropic',
  model: 'claude-sonnet-4-5',
  memberId: 'member-1',
  status: 'idle',
  config: '{}',
  tasks: [],
  ...overrides,
});

const makeTask = (overrides: Record<string, unknown> = {}) => ({
  id: 'task-1',
  title: 'Build REST API',
  description: 'Build the REST API',
  status: 'ready',
  type: 'task',
  priority: 'medium',
  projectId: 'project-1',
  teamId: 'team-1',
  requiredRole: undefined,
  storyPoints: 5,
  ...overrides,
});

describe('assignment-planner', () => {
  describe('scoreAgentForTask', () => {
    it('returns a score with reason', () => {
      const agent = makeAgent({ name: 'Backend Developer #1', status: 'idle' });
      const task = makeTask({ requiredRole: 'Backend Developer' });

      const result = scoreAgentForTask(agent, task, 'project-1');

      expect(result).toHaveProperty('score');
      expect(result).toHaveProperty('reason');
      expect(typeof result.score).toBe('number');
    });

    it('idle agent gets positive score', () => {
      const agent = makeAgent({ status: 'idle', name: 'Backend Developer #1' });
      const task = makeTask({ requiredRole: 'Backend Developer' });

      const result = scoreAgentForTask(agent, task, 'project-1');

      expect(result.score).toBeGreaterThan(0);
    });

    it('working agent gets reduced score', () => {
      const agent = makeAgent({ status: 'working', name: 'Backend Developer #1' });
      const task = makeTask({ requiredRole: 'Backend Developer' });

      const result = scoreAgentForTask(agent, task, 'project-1');

      expect(result.score).toBeLessThan(40);
    });

    it('overloaded agent gets reduced score', () => {
      const agent = makeAgent({
        status: 'idle',
        name: 'Backend Developer #1',
        tasks: [
          { status: 'in_progress' },
          { status: 'in_progress' },
          { status: 'in_progress' },
          { status: 'in_progress' },
        ],
      });
      const task = makeTask({ requiredRole: 'Backend Developer' });

      const result = scoreAgentForTask(agent, task, 'project-1');

      expect(result.score).toBeLessThan(40);
    });
  });

  describe('findBestAgentForTask', () => {
    it('selects best agent by highest score', () => {
      const task = makeTask({ requiredRole: 'Backend Developer' });
      const agents = [
        makeAgent({ id: 'agent-low', name: 'Low Score', status: 'working' }),
        makeAgent({ id: 'agent-high', name: 'Backend Developer #1', status: 'idle' }),
      ];

      const best = findBestAgentForTask(task, agents, 'project-1');

      expect(best?.id).toBe('agent-high');
    });

    it('returns null when no candidates', () => {
      const task = makeTask({ requiredRole: 'Backend Developer' });

      const best = findBestAgentForTask(task, [], 'project-1');

      expect(best).toBeNull();
    });
  });

  describe('assignTasksToAgents', () => {
    it('does not double-assign agents', async () => {
      const tasks = [
        makeTask({ id: 'task-1', title: 'Task 1' }),
        makeTask({ id: 'task-2', title: 'Task 2' }),
      ];
      const agents = [
        makeAgent({ id: 'agent-1', name: 'Backend Developer #1' }),
      ];

      const assignments = await assignTasksToAgents(tasks, agents, 'project-1');

      const assignedToAgent1 = assignments.filter((a: any) => a.agentId === 'agent-1');
      expect(assignedToAgent1).toHaveLength(1);
    });

    it('returns empty when no agents', async () => {
      const tasks = [makeTask({ id: 'task-1' })];
      const assignments = await assignTasksToAgents(tasks, [], 'project-1');
      expect(assignments).toEqual([]);
    });
  });

  describe('getAvailableAgents', () => {
    it('returns idle agents with < 4 active tasks', async () => {
      prisma.project.findUnique.mockResolvedValue({
        id: 'project-1',
        team: {
          members: [
            { id: 'm-1', role: 'Backend Developer', agents: [{ id: 'a-1', status: 'idle', tasks: [], memberId: 'm-1' }] },
            { id: 'm-2', role: 'Frontend Developer', agents: [{ id: 'a-2', status: 'working', tasks: [], memberId: 'm-2' }] },
          ],
        },
      });

      const result = await getAvailableAgents('project-1');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('a-1');
    });
  });

  describe('suggestTaskSplit', () => {
    it('suggests task splits for storyPoints >= 8', () => {
      const task = makeTask({ id: 'task-1', title: 'Big Feature', storyPoints: 8 });

      const split: any = suggestTaskSplit(task);

      expect(split).toBeDefined();
      expect(split.subTasks.length).toBeGreaterThanOrEqual(2);
    });

    it('returns no split for small tasks', () => {
      const task = makeTask({ id: 'task-1', title: 'Small Feature', storyPoints: 3 });

      const split: any = suggestTaskSplit(task);

      expect(split).toBeDefined();
      expect(split.subTasks.length).toBe(0);
    });
  });
});
