jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		agent: { findUnique: jest.fn() },
		agentRoleAssignment: { findFirst: jest.fn() },
	},
}));

const mockPrisma = jest.requireMock('../lib/prisma').default;

import { buildAgentSystemPrompt, MAX_SYSTEM_PROMPT_CHARS } from '../lib/agent-context';

const baseAgent = {
	id: 'agent-1',
	name: 'Alex1',
	type: 'openai',
	model: 'gpt-5',
	memberId: 'member-1',
	status: 'idle',
	config: '{}',
	member: {
		id: 'member-1',
		name: 'Alex1 Member',
		role: 'Senior Developer',
		type: 'ai',
		team: {
			id: 'team-1',
			name: 'Engineering Team',
			description: 'Core platform engineering team.',
			status: 'active',
			project: null,
			members: [
				{
					id: 'member-1',
					name: 'Alex1 Member',
					role: 'Senior Developer',
					type: 'ai',
					agents: [{ id: 'agent-1', name: 'Alex1', status: 'idle' }],
				},
			],
		},
	},
	tasks: [],
};

beforeEach(() => {
	jest.clearAllMocks();
	mockPrisma.agent.findUnique.mockResolvedValue(baseAgent);
	mockPrisma.agentRoleAssignment.findFirst.mockResolvedValue(null);
});

it('includes grounding rules and explicit missing states when no teammates exist', async () => {
	const prompt = await buildAgentSystemPrompt('agent-1', 'Base prompt');
	expect(prompt).toContain('AgentHQ grounding rules');
	expect(prompt).toContain('If conversation history conflicts with current AgentHQ facts');
	expect(prompt).toContain('Engineering Team');
	expect(prompt).toContain('No other team members are currently assigned.');
	expect(prompt).toContain('No project is currently assigned to this team.');
	expect(prompt).toContain('No active sprint is currently assigned.');
	expect(prompt).toContain('No active tasks are currently assigned.');
	expect(prompt).not.toContain('Alex3');
});

it('includes real teammates and excludes the current agent from other teammates', async () => {
	mockPrisma.agent.findUnique.mockResolvedValue({
		...baseAgent,
		member: {
			...baseAgent.member,
			team: {
				...baseAgent.member.team,
				members: [
					baseAgent.member.team.members[0],
					{ id: 'member-2', name: 'Priya', role: 'QA Engineer', type: 'human', agents: [] },
					{ id: 'member-3', name: 'Alex2 Member', role: 'Senior Developer', type: 'ai', agents: [{ id: 'agent-2', name: 'Alex2', status: 'working' }] },
				],
			},
		},
	});

	const prompt = await buildAgentSystemPrompt('agent-1', 'Base prompt');
	expect(prompt).toContain('Priya — QA Engineer — Human');
	expect(prompt).toContain('Alex2 — Senior Developer — AI Agent — working');
	expect(prompt).not.toContain('Alex1 — Senior Developer — AI Agent');
});

it('includes role group context, instructions, skills, and agent-specific prompt', async () => {
	mockPrisma.agent.findUnique.mockResolvedValue({
		...baseAgent,
		config: JSON.stringify({ systemPrompt: 'Prefer tests.' }),
	});
	mockPrisma.agentRoleAssignment.findFirst.mockResolvedValue({
		roleGroup: {
			name: 'Backend Engineering',
			description: 'Backend-focused delivery role.',
			instructions: [{ filename: 'rules.md', title: 'Rules', content: 'Follow repo conventions.' }],
			skills: [{ name: 'TypeScript', level: 'advanced', description: 'strict mode' }],
		},
	});

	const prompt = await buildAgentSystemPrompt('agent-1', 'Base prompt');
	expect(prompt).toContain('Role Group: Backend Engineering');
	expect(prompt).toContain('Backend-focused delivery role.');
	expect(prompt).toContain('Follow repo conventions.');
	expect(prompt).toContain('TypeScript');
	expect(prompt).toContain('Prefer tests.');
});

it('includes assigned task, project, and active sprint facts', async () => {
	const activeSprint = {
		id: 'sprint-1',
		name: 'Stabilization Sprint',
		goal: 'Ground Agent Office.',
		status: 'active',
		startDate: new Date('2026-09-01T00:00:00.000Z'),
		endDate: new Date('2026-09-30T00:00:00.000Z'),
	};
	const project = {
		id: 'project-1',
		name: 'AgentHQ',
		description: 'Agent dashboard.',
		status: 'active',
		progress: 45,
		repoUrl: 'https://github.com/example/agenthq',
	};
	mockPrisma.agent.findUnique.mockResolvedValue({
		...baseAgent,
		member: {
			...baseAgent.member,
			team: { ...baseAgent.member.team, project },
		},
		tasks: [{
			title: 'Implement audit logging',
			status: 'in_progress',
			priority: 'high',
			blocked: false,
			dueDate: new Date('2026-09-20T00:00:00.000Z'),
			project,
			sprint: activeSprint,
		}],
	});

	const prompt = await buildAgentSystemPrompt('agent-1', 'Base prompt');
	expect(prompt).toContain('AgentHQ');
	expect(prompt).toContain('Progress: 45%');
	expect(prompt).toContain('Stabilization Sprint');
	expect(prompt).toContain('Implement audit logging');
	expect(prompt).toContain('Task status: in_progress');
	expect(prompt).toContain('Priority: high');
});

it('bounds large teams, tasks, instructions, and preserves grounding rules', async () => {
	mockPrisma.agent.findUnique.mockResolvedValue({
		...baseAgent,
		config: JSON.stringify({ systemPrompt: 'A'.repeat(5000) }),
		member: {
			...baseAgent.member,
			team: {
				...baseAgent.member.team,
				members: [
					baseAgent.member.team.members[0],
					...Array.from({ length: 80 }, (_, index) => ({
						id: `member-${index + 2}`,
						name: `Teammate ${index}`,
						role: 'Developer',
						type: 'human',
						agents: [],
					})),
				],
			},
		},
		tasks: Array.from({ length: 30 }, (_, index) => ({
			title: `Task ${index}`,
			status: 'in_progress',
			priority: 'high',
			blocked: false,
			dueDate: null,
			project: null,
			sprint: null,
		})),
	});
	mockPrisma.agentRoleAssignment.findFirst.mockResolvedValue({
		roleGroup: {
			name: 'Backend Developer',
			description: 'Role',
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
	expect(prompt).toContain('AgentHQ grounding rules');
	expect(prompt).toContain('Showing 50 of 80 current team members.');
	expect(prompt).toContain('Never invent people');
});
