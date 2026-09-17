import { registerAgentTool, getAgentTool, listAgentTools, hasAgentTool, clearAgentTools } from '../lib/agent-tools/registry';
import type { AgentToolDefinition } from '../lib/agent-tools/types';

const stubTool: AgentToolDefinition = {
  name: 'stub_tool',
  description: 'A test stub tool',
  inputSchema: { type: 'object', properties: {} },
  risk: 'read',
  approvalMode: 'none',
  allowedActors: ['project-control'],
  async execute() { return { ok: true }; },
};

beforeEach(() => {
  clearAgentTools();
});

it('registers and retrieves a tool by name', () => {
  registerAgentTool(stubTool);
  expect(hasAgentTool('stub_tool')).toBe(true);
  expect(getAgentTool('stub_tool')?.description).toBe('A test stub tool');
});

it('returns null for unknown tools', () => {
  expect(getAgentTool('missing_tool')).toBeNull();
  expect(hasAgentTool('missing_tool')).toBe(false);
});

it('rejects duplicate tool names', () => {
  registerAgentTool(stubTool);
  expect(() => registerAgentTool({ ...stubTool, name: 'stub_tool' })).toThrow(/already registered/i);
});

it('lists all registered tools', () => {
  registerAgentTool(stubTool);
  registerAgentTool({ ...stubTool, name: 'another_tool' });
  const names = listAgentTools().map((t) => t.name).sort();
  expect(names).toEqual(['another_tool', 'stub_tool']);
});

it('clears the registry', () => {
  registerAgentTool(stubTool);
  clearAgentTools();
  expect(listAgentTools()).toEqual([]);
});
