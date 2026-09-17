import prisma from '../lib/prisma';

jest.mock('../lib/prisma', () => ({
  __esModule: true,
  default: {
    project: { findFirst: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
    team: { findUnique: jest.fn(), create: jest.fn() },
    sprint: { findFirst: jest.fn(), create: jest.fn() },
    task: { findMany: jest.fn(), create: jest.fn() },
    roleGroup: { create: jest.fn() },
    $transaction: jest.fn(async (cb: any) => {
      const tx = {
        sprint: { create: jest.fn().mockResolvedValue({ id: 'sprint-1', order: 0 }) },
      };
      return cb(tx);
    }),
  },
}));

jest.mock('../lib/agent-tools/tools/find-bench-agents', () => ({
  findBenchAgentsTool: {
    execute: jest.fn().mockResolvedValue({ ok: true, data: { matches: [] } }),
  },
}));

const proposalStore: Record<string, any> = {};
jest.mock('../lib/proposal-store', () => ({
  recordProposal: jest.fn((proposal: any) => {
    proposalStore[proposal.id] = proposal;
    return proposal;
  }),
  consumeProposal: jest.fn((id: string) => proposalStore[id] || null),
}));

const prisma = jest.requireMock('../lib/prisma').default;
const { recordProposal, consumeProposal } = jest.requireMock('../lib/proposal-store');

import { proposeProjectBootstrapTool, applyProjectBootstrap } from '../lib/agent-tools/tools/propose-project-bootstrap';

beforeEach(() => {
  jest.clearAllMocks();
  delete proposalStore['proposal_project_bootstrap_1'];
  delete proposalStore['proposal_project_bootstrap_2'];
  (prisma.project.findFirst as jest.Mock).mockResolvedValue(null);
  (prisma.team.create as jest.Mock).mockResolvedValue({ id: 'team-1', name: 'Test Team' });
  (prisma.roleGroup.create as jest.Mock).mockResolvedValue({ id: 'rg-1' });
  (prisma.project.create as jest.Mock).mockResolvedValue({ id: 'proj-1', name: 'Test', teamId: 'team-1', status: 'active' });
  (prisma.sprint.create as jest.Mock).mockResolvedValue({ id: 'sprint-1', order: 0 });
  (prisma.task.create as jest.Mock).mockResolvedValue({ id: 'task-1' });
});

describe('propose-project-bootstrap', () => {
  it('proposes bootstrap when no project exists', async () => {
    const result = await proposeProjectBootstrapTool.execute({ projectName: 'Weather Teller', role: 'Full Stack' });
    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.projectName).toBe('Weather Teller');
    expect(data.primaryRole).toBe('Full Stack');
    expect(data.proposalId).toBeDefined();
    expect(data.existingProjectId).toBeNull();
  });

  it('proposes bootstrap with existing active project', async () => {
    (prisma.project.findFirst as jest.Mock).mockResolvedValue({ id: 'proj-existing', name: 'Existing', teamId: 'team-1', status: 'active' });

    const result = await proposeProjectBootstrapTool.execute({ projectName: 'Weather Teller', role: 'Full Stack', sprintCount: 2, tasksPerSprint: 3 });
    expect(result.ok).toBe(true);
    const data = result.data as Record<string, unknown>;
    expect(data.sprintCount).toBe(2);
    expect(data.tasksPerSprint).toBe(3);
    expect((data.newTasks as unknown[])).toHaveLength(6);
    expect(data.existingProjectId).toBe('proj-existing');
  });

  it('apply_project_bootstrap creates a new project when no existing project', async () => {
    const result = await proposeProjectBootstrapTool.execute({ projectName: 'Weather Teller', role: 'Full Stack', sprintCount: 1, tasksPerSprint: 2 });
    const proposalId = (result.data as Record<string, unknown>).proposalId as string;
    (prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

    const applyResult = await applyProjectBootstrap(proposalId);
    expect(applyResult.ok).toBe(true);
    const data = applyResult.data as Record<string, unknown>;
    expect(data.projectId).toBeDefined();
    expect(data.tasksCreated).toBe(2);
    expect(data.sprintsCreated).toBe(1);
  });

  it('apply_project_bootstrap adds sprints to existing project', async () => {
    const existingProject = { id: 'proj-existing', name: 'Existing', teamId: 'team-existing', status: 'active' };
    (prisma.project.findFirst as jest.Mock).mockResolvedValue(existingProject);

    const result = await proposeProjectBootstrapTool.execute({ projectName: 'Existing', role: 'Full Stack', sprintCount: 2, tasksPerSprint: 3 });
    const proposalId = (result.data as Record<string, unknown>).proposalId as string;
    (prisma.project.findUnique as jest.Mock).mockResolvedValue(existingProject);

    const applyResult = await applyProjectBootstrap(proposalId);
    expect(applyResult.ok).toBe(true);
    const data = applyResult.data as Record<string, unknown>;
    expect((data.message as string)).toContain('Added');
  });

  it('returns error for expired proposal', async () => {
    const applyResult = await applyProjectBootstrap('nonexistent_proposal');
    expect(applyResult.ok).toBe(false);
    expect((applyResult.error as Record<string, string>).code).toBe('PROPOSAL_NOT_FOUND');
  });
});
