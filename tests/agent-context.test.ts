jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		agent: { findUnique: jest.fn() },
		agentRoleAssignment: { findFirst: jest.fn() },
	},
}));

const mockPrisma = jest.requireMock('../lib/prisma').default;

import { buildAgentSystemPrompt, MAX_SYSTEM_PROMPT_CHARS } from '../lib/agent-context';

beforeEach(() => {
	jest.clearAllMocks();
	mockPrisma.agent.findUnique.mockResolvedValue({
		id: 'agent-1',
		name: 'Ada',
		member: { role: 'Developer' },
		config: '{}',
	});
	mockPrisma.agentRoleAssignment.findFirst.mockResolvedValue(null);
});

it('uses the fallback prompt without role sections when no role group is assigned', async () => {
	const prompt = await buildAgentSystemPrompt('agent-1', 'Base prompt');
	expect(prompt).toContain('Base prompt');
	expect(prompt).not.toContain('Role instructions');
	expect(prompt).not.toContain('Skills');
});

it('includes role instructions, skills, and agent-specific prompt', async () => {
	mockPrisma.agent.findUnique.mockResolvedValue({
		id: 'agent-1',
		name: 'Ada',
		member: { role: 'Developer' },
		config: JSON.stringify({ systemPrompt: 'Prefer tests.' }),
	});
	mockPrisma.agentRoleAssignment.findFirst.mockResolvedValue({
		roleGroup: {
			name: 'Backend Developer',
			instructions: [{ filename: 'rules.md', title: 'Rules', content: 'Follow repo conventions.' }],
			skills: [{ name: 'TypeScript', level: 'advanced', description: 'strict mode' }],
		},
	});

	const prompt = await buildAgentSystemPrompt('agent-1', 'Base prompt');
	expect(prompt).toContain('Backend Developer');
	expect(prompt).toContain('Follow repo conventions.');
	expect(prompt).toContain('TypeScript');
	expect(prompt).toContain('Prefer tests.');
});

it('bounds individual, aggregate, skill, and final prompt sizes', async () => {
	mockPrisma.agent.findUnique.mockResolvedValue({
		id: 'agent-1',
		name: 'Ada',
		member: { role: 'Developer' },
		config: JSON.stringify({ systemPrompt: 'A'.repeat(5000) }),
	});
	mockPrisma.agentRoleAssignment.findFirst.mockResolvedValue({
		roleGroup: {
			name: 'Backend Developer',
			instructions: Array.from({ length: 8 }, (_, index) => ({
				filename: `rules-${index}.md`,
				title: `Rules ${index}`,
				content: `${index}`.repeat(5000),
			})),
			skills: Array.from({ length: 80 }, (_, index) => ({
				name: `Skill ${index}`,
				level: 'expert',
				description: 'D'.repeat(200),
			})),
		},
	});

	const prompt = await buildAgentSystemPrompt('agent-1', 'Base prompt');
	expect(prompt.length).toBeLessThanOrEqual(MAX_SYSTEM_PROMPT_CHARS);
	expect(prompt).toContain('Base prompt');
	expect(prompt).toContain('Role instructions');
	expect(prompt).toContain('Agent-specific instructions');
});

