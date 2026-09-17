import { proposeCapacityChangeTool, applyCapacityChange } from '../lib/agent-tools/tools/propose-capacity-change';

jest.mock('../lib/prisma', () => ({
 __esModule: true,
 default: {
  project: { findUnique: jest.fn(), update: jest.fn() },
  team: { findUnique: jest.fn(), findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
  member: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
  agent: { findMany: jest.fn(), update: jest.fn(), create: jest.fn(), findUnique: jest.fn() },
  agentRoleAssignment: { findMany: jest.fn(), upsert: jest.fn() },
  executionRun: { findFirst: jest.fn() },
  executionProposal: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  task: { findFirst: jest.fn(), update: jest.fn() },
  activity: { create: jest.fn() },
  $disconnect: jest.fn(),
 },
}));

jest.mock('../lib/agent-tools/tools/find-bench-agents', () => ({
 findBenchAgentsTool: {
  execute: jest.fn(),
 },
}));

jest.mock('../lib/proposal-store', () => ({
 recordProposal: jest.fn((r: any) => r),
 consumeProposal: jest.fn((id: string) => ({ id, result: { data: { benchMatches: [], slots: 0, teamId: 'team-1' } }, createdAt: new Date(), ttlMs: 3600000 })),
 getProposal: jest.fn(() => undefined),
 cleanupExpired: jest.fn(),
}));

const mockPrisma = jest.requireMock('../lib/prisma').default as Record<string, jest.Mock>;
const mockFindBenchAgents = jest.requireMock('../lib/agent-tools/tools/find-bench-agents').findBenchAgentsTool as { execute: jest.Mock };

const FIXED_NOW = new Date('2026-01-15T10:00:00Z');

describe('propose_capacity_change', () => {
 beforeEach(() => jest.clearAllMocks());

 const projectId = 'proj-1';

 it('proposes hiring by finding bench matches', async () => {
  // project.include.team.members.include.agents
  mockPrisma.project.findUnique.mockResolvedValue({
   id: projectId, name: 'Test', teamId: 'team-1', status: 'active',
   team: { id: 'team-1', members: [] },
  });

  (mockFindBenchAgents.execute as jest.Mock).mockResolvedValue({
   ok: true, data: { matches: [{ agentId: 'a1', memberId: 'm1', name: 'Alice', role: 'Full Stack Developer', score: 100 }] },
  });

  const result = await proposeCapacityChangeTool.execute(
   { projectId, change: 'hire', role: 'Full Stack Developer', maxSlots: 2, reason: 'test' },
   { actorType: 'project-control' as const, now: FIXED_NOW },
  );

  expect(result.ok).toBe(true);
  const data = result.data as any;
  expect(data.benchMatches.length).toBeGreaterThanOrEqual(1);
  expect(data.proposalId).toBeDefined();
  expect(data.slots).toBe(2);
  expect(data.change).toBe('hire');
  expect(mockFindBenchAgents.execute).toHaveBeenCalled();
 });

 it('rejects when project not found', async () => {
  mockPrisma.project.findUnique.mockResolvedValue(null);

  const result = await proposeCapacityChangeTool.execute(
   { projectId, change: 'hire', role: 'Something', maxSlots: 1, reason: 'test' },
   { actorType: 'project-control' as const, now: FIXED_NOW },
  );

  expect(result.ok).toBe(false);
  expect((result.error as any)?.code).toBe('PROJECT_NOT_FOUND');
 });

 it('handles remove proposal with agentId', async () => {
  mockPrisma.project.findUnique.mockResolvedValue({
   id: projectId, name: 'Test', teamId: 'team-1', status: 'active',
   team: {
    id: 'team-1',
    members: [{ id: 'm1', name: 'Alice', role: 'Full Stack Developer', agents: [{ id: 'a1', name: 'Alice' }] }],
   },
  });

  const result = await proposeCapacityChangeTool.execute(
   { projectId, change: 'remove', agentId: 'a1', reason: 'test' },
   { actorType: 'project-control' as const, now: FIXED_NOW },
  );

  expect(result.ok).toBe(true);
  const data = result.data as any;
  expect(data.change).toBe('remove');
  expect(data.agentId).toBe('a1');
  expect(data.proposalId).toBeDefined();
 });

 it('rejects remove without agentId', async () => {
  mockPrisma.project.findUnique.mockResolvedValue({
   id: projectId, name: 'Test', teamId: 'team-1', status: 'active',
  });

  const result = await proposeCapacityChangeTool.execute(
   { projectId, change: 'remove', reason: 'test' },
   { actorType: 'project-control' as const, now: FIXED_NOW },
  );

  expect(result.ok).toBe(false);
  expect((result.error as any)?.code).toBe('INVALID_INPUT');
 });
});

describe('apply_capacity_change', () => {
 beforeEach(() => jest.clearAllMocks());

 it('moves bench agent to project team', async () => {
  const proposalData = { benchMatches: [{ agentId: 'a1', memberId: 'm1', name: 'Alice' }], slots: 1, teamId: 'team-1' };
  (require('../lib/proposal-store') as any).consumeProposal.mockReturnValueOnce({
   id: 'proposal-1',
   toolName: 'propose_capacity_change',
   result: { ok: true, data: proposalData },
   createdAt: new Date(),
   expiresAt: new Date(Date.now() + 3600000),
  });

  mockPrisma.member.update.mockResolvedValue({ id: 'm1', teamId: 'team-1' });
  mockPrisma.executionProposal.update.mockResolvedValue({ id: 'proposal-1', status: 'completed' });
  mockPrisma.agent.findUnique.mockResolvedValue({ id: 'a1', memberId: 'm1' });

  const result = await applyCapacityChange('proposal-1');

  expect(result.ok).toBe(true);
  const data = result.data as any;
  expect(data.assigned.length).toBe(1);
  expect(data.assigned[0]).toBe('a1');
 });

 it('rejects expired or consumed proposal', async () => {
  (require('../lib/proposal-store') as any).consumeProposal.mockReturnValueOnce(null);

  const result = await applyCapacityChange('nonexistent');
  expect(result.ok).toBe(false);
  expect((result.error as any)?.code).toBe('PROPOSAL_NOT_FOUND');
 });

 it('handles new hire when no bench matches', async () => {
  (require('../lib/proposal-store') as any).consumeProposal.mockReturnValueOnce({
   id: 'proposal-2',
   toolName: 'propose_capacity_change',
   result: { ok: true, data: { benchMatches: [], slots: 0, teamId: 'team-1' } },
   createdAt: new Date(),
   expiresAt: new Date(Date.now() + 3600000),
  });

  mockPrisma.member.create.mockResolvedValue({ id: 'new-member', name: 'AI Researcher', teamId: 'team-1' });
  mockPrisma.agent.create.mockResolvedValue({ id: 'new-agent', name: 'AI Researcher (new hire)', memberId: 'new-member' });
  mockPrisma.executionProposal.update.mockResolvedValue({ id: 'proposal-2', status: 'completed' });

  const result = await applyCapacityChange('proposal-2');

  expect(result.ok).toBe(true);
  const data = result.data as any;
  expect(data.newHire).toBe(true);
  expect(data.agentId).toBe('new-agent');
 });
});
