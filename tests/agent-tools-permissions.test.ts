import { registerAgentTool, clearAgentTools } from '../lib/agent-tools/registry';
import { executeAgentToolCall } from '../lib/agent-tools/runtime';
import { validateToolActor, validateToolPermission, resolveAllowedTools, type AgentToolContext } from '../lib/agent-tools/permissions';
import type { AgentToolDefinition } from '../lib/agent-tools/types';

const readTool: AgentToolDefinition = {
  name: 'get_task',
  description: 'Read a task',
  inputSchema: { type: 'object', properties: { taskId: { type: 'string' } }, required: ['taskId'] },
  risk: 'read',
  approvalMode: 'none',
  allowedActors: ['project-control', 'agent'],
  async execute() { return { ok: true }; },
};

const proposalTool: AgentToolDefinition = {
  name: 'propose_task',
  description: 'Propose a task',
  inputSchema: { type: 'object', properties: { projectId: { type: 'string' } }, required: ['projectId'] },
  risk: 'low',
  approvalMode: 'proposal',
  allowedActors: ['project-control'],
  async execute() { return { ok: true }; },
};

beforeEach(() => {
  clearAgentTools();
  registerAgentTool(readTool);
  registerAgentTool(proposalTool);
});

describe('validateToolActor', () => {
  it('allows project-control to use get_task', async () => {
    const result = await executeAgentToolCall(
      { id: 'c1', name: 'get_task', arguments: { taskId: 'x' } },
      { actorType: 'project-control', now: new Date() },
    );
    expect(result.ok).toBe(true);
  });

  it('allows agent to use get_task', async () => {
    const result = await executeAgentToolCall(
      { id: 'c2', name: 'get_task', arguments: { taskId: 'x' } },
      { actorType: 'agent', now: new Date() },
    );
    expect(result.ok).toBe(true);
  });

  it('blocks agent from propose_task (actor)', async () => {
    const result = await executeAgentToolCall(
      { id: 'c3', name: 'propose_task', arguments: { projectId: 'x' } },
      { actorType: 'agent', now: new Date() },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('ACTOR_NOT_ALLOWED');
  });

  it('blocks worker from get_task', async () => {
    const result = await executeAgentToolCall(
      { id: 'c4', name: 'get_task', arguments: { taskId: 'x' } },
      { actorType: 'worker', now: new Date() },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('ACTOR_NOT_ALLOWED');
  });

  it('returns TOOL_NOT_FOUND for unknown tools', async () => {
    const result = await executeAgentToolCall(
      { id: 'c5', name: 'missing_tool', arguments: {} },
      { actorType: 'project-control', now: new Date() },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('TOOL_NOT_FOUND');
  });
});

describe('validateToolPermission', () => {
  it('project-control persona can use propose_task', () => {
    expect(() => validateToolPermission(proposalTool, { actorType: 'project-control', persona: 'project-control', now: new Date() }))
      .not.toThrow();
  });

  it('scrum-master persona cannot use propose_task', () => {
    expect(() => validateToolPermission(proposalTool, { actorType: 'project-control', persona: 'scrum-master', now: new Date() }))
      .toThrow(/Permission denied/);
  });

  it('returns ACTOR_NOT_ALLOWED code from runtime', async () => {
    const result = await executeAgentToolCall(
      { id: 'c6', name: 'propose_task', arguments: { projectId: 'x' } },
      { actorType: 'scrum-master', now: new Date() },
    );
    expect(result.ok).toBe(false);
    expect(result.error?.code).toBe('ACTOR_NOT_ALLOWED');
  });
});

describe('resolveAllowedTools', () => {
  const ctx = (overrides: Partial<AgentToolContext> = {}): AgentToolContext => ({
    actorType: 'project-control',
    now: new Date(),
    ...overrides,
  });

  it('returns full tool list for project-control persona', () => {
    const tools = resolveAllowedTools(ctx({ persona: 'project-control' }));
    expect(tools).toContain('get_task');
    expect(tools).toContain('propose_task');
  });

  it('returns scrum-master subset', () => {
    const tools = resolveAllowedTools(ctx({ persona: 'scrum-master' }));
    expect(tools).toContain('get_task');
    expect(tools).not.toContain('propose_task');
  });

  it('returns worker defaults', () => {
    expect(resolveAllowedTools({ actorType: 'worker', now: new Date() })).toEqual([
      'get_task',
      'get_project_status',
      'get_task_memory',
      'get_latest_checkpoint',
      'get_task_review',
    ]);
  });

  it('returns agent defaults', () => {
    expect(resolveAllowedTools({ actorType: 'agent', now: new Date() })).toEqual([
      'get_project_status',
      'get_task',
      'get_execution_status',
      'get_project_memory',
      'get_task_memory',
      'get_relevant_decisions',
      'get_latest_checkpoint',
      'get_task_handoff',
      'get_task_review',
    ]);
  });
});
