jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {},
}));

jest.mock('../lib/configured-models', () => ({
	readConfiguredModels: jest.fn(),
}));

import { getProjectControlStatus } from '../lib/project-control';

function sampleProject() {
	return {
		id: 'project-1',
		name: 'Customer Portal',
		description: 'Portal',
		status: 'active',
		progress: 42,
		repoUrl: 'https://example.test/repo',
		teamId: 'team-1',
		team: {
			id: 'team-1',
			name: 'Customer Portal Team',
			description: 'Delivery team',
			status: 'active',
			members: [
				{
					id: 'member-1',
					name: 'Backend Developer #1',
					role: 'Backend Developer',
					type: 'ai',
					tasks: [],
					agents: [
						{
							id: 'agent-1',
							name: 'Backend Developer #1',
							status: 'idle',
							model: 'gpt-5',
							config: JSON.stringify({ configuredModelId: 'model-1' }),
							tasks: [
								{ id: 'task-1', status: 'in_progress', blocked: false },
								{ id: 'task-2', status: 'blocked', blocked: true },
							],
						},
					],
				},
				{ id: 'member-2', name: 'Alex', role: 'PM', type: 'human', tasks: [], agents: [] },
			],
		},
		tasks: [
			{
				id: 'task-1',
				title: 'Build checkout',
				description: null,
				status: 'in_progress',
				priority: 'high',
				agentId: 'agent-1',
				assigneeId: null,
				agent: { id: 'agent-1', name: 'Backend Developer #1' },
				assignee: null,
				sprint: { id: 'sprint-1', name: 'Sprint 1' },
				blocked: false,
				blockedReason: null,
				dueDate: null,
				storyPoints: 5,
			},
			{
				id: 'task-2',
				title: 'Fix payment blocker',
				description: null,
				status: 'blocked',
				priority: 'critical',
				agentId: 'agent-1',
				assigneeId: null,
				agent: { id: 'agent-1', name: 'Backend Developer #1' },
				assignee: null,
				sprint: { id: 'sprint-1', name: 'Sprint 1' },
				blocked: true,
				blockedReason: 'Provider credentials missing',
				dueDate: null,
				storyPoints: 3,
			},
		],
		sprints: [
			{
				id: 'sprint-1',
				name: 'Sprint 1',
				goal: 'Checkout',
				status: 'active',
				startDate: new Date('2026-09-01'),
				endDate: new Date('2026-09-30'),
				tasks: [
					{ status: 'in_progress', blocked: false },
					{ status: 'blocked', blocked: true },
				],
			},
		],
		milestones: [{ id: 'milestone-1', title: 'MVP', status: 'pending', order: 1 }],
	};
}

it('returns live Project Control status with counts, sprint, assignments, and risks', async () => {
	const db: any = {
		project: { findUnique: jest.fn().mockResolvedValue(sampleProject()) },
		agentRoleAssignment: { findMany: jest.fn().mockResolvedValue([{ agentId: 'agent-1', roleGroupId: 'role-backend' }]) },
	};

	const status = await getProjectControlStatus('project-1', db);

	expect(status?.project.name).toBe('Customer Portal');
	expect(status?.team.agentCount).toBe(1);
	expect(status?.team.humanMemberCount).toBe(1);
	expect(status?.taskCounts.in_progress).toBe(1);
	expect(status?.taskCounts.blocked).toBe(1);
	expect(status?.activeSprint?.name).toBe('Sprint 1');
	expect(status?.tasks[0].assignedAgent?.name).toBe('Backend Developer #1');
	expect(status?.agents[0].roleGroupId).toBe('role-backend');
	expect(status?.risks.some((risk) => risk.id === 'blocked-tasks')).toBe(true);
});
