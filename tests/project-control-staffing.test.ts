jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		$transaction: jest.fn(),
	},
}));

jest.mock('../lib/configured-models', () => ({
	readConfiguredModels: jest.fn(),
}));

const mockPrisma = jest.requireMock('../lib/prisma').default;
const mockModels = jest.requireMock('../lib/configured-models');

import { applyStaffing, proposeStaffing } from '../lib/project-control';

function baseStatusProject(agentOverrides: any[] = []) {
	const agents = agentOverrides.map((agent, index) => ({
		id: agent.id || `agent-${index + 1}`,
		name: agent.name || `Agent #${index + 1}`,
		status: agent.status || 'idle',
		model: 'gpt-5',
		config: '{}',
		tasks: agent.tasks || [],
	}));
	return {
		id: 'project-1',
		name: 'Customer Portal',
		description: null,
		status: 'active',
		progress: 10,
		repoUrl: null,
		teamId: 'team-1',
		team: {
			id: 'team-1',
			name: 'Team',
			description: null,
			status: 'active',
			members: agents.map((agent) => ({ id: `${agent.id}-member`, name: agent.name, role: 'Backend Developer', type: 'ai', tasks: [], agents: [agent] })),
		},
		tasks: [],
		sprints: [],
		milestones: [],
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	mockModels.readConfiguredModels.mockResolvedValue([
		{ id: 'model-1', name: 'Primary Coding Model', gatewayId: 'gw-1', gatewayName: 'Gateway', provider: 'openai', modelId: 'gpt-5' },
	]);
});

it('proposal does not mutate the database', async () => {
	const db: any = {
		project: { findUnique: jest.fn().mockResolvedValue(baseStatusProject([{ id: 'agent-1' }])) },
		agentRoleAssignment: { findMany: jest.fn().mockResolvedValue([]) },
		roleGroup: { findMany: jest.fn().mockResolvedValue([{ id: 'role-backend', name: 'Backend Engineering' }]) },
	};

	const proposal = await proposeStaffing('project-1', { requirement: 'Add payment integration', targetAgentCount: 2 }, db);

	expect(proposal.hires).toHaveLength(1);
	expect(proposal.hires[0].role).toBe('Backend Developer');
	expect(db.project.findUnique).toHaveBeenCalled();
	expect(mockPrisma.$transaction).not.toHaveBeenCalled();
});

it('apply without approved=true fails', async () => {
	await expect(applyStaffing('project-1', { approved: false, hires: [], removals: [] })).rejects.toThrow('Explicit approval is required');
	expect(mockPrisma.$transaction).not.toHaveBeenCalled();
});

it('approved hire creates Member, Agent, Role Group assignment, and Activity in one transaction', async () => {
	const tx: any = {
		project: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1', name: 'Customer Portal', teamId: 'team-1', team: { id: 'team-1' } }) },
		gateway: { findUnique: jest.fn().mockResolvedValue({ id: 'gw-1' }) },
		roleGroup: { findUnique: jest.fn().mockResolvedValue({ id: 'role-backend' }) },
		member: { create: jest.fn().mockResolvedValue({ id: 'member-1' }) },
		agent: { create: jest.fn().mockResolvedValue({ id: 'agent-1', name: 'Backend Developer #1', status: 'idle' }) },
		agentRoleAssignment: { create: jest.fn().mockResolvedValue({}) },
		activity: { create: jest.fn().mockResolvedValue({}) },
	};
	mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

	const result = await applyStaffing('project-1', {
		approved: true,
		hires: [{ name: 'Backend Developer #1', role: 'Backend Developer', configuredModelId: 'model-1', roleGroupId: 'role-backend' }],
		removals: [],
	});

	expect(result.hired).toEqual([{ agentId: 'agent-1', role: 'Backend Developer', name: 'Backend Developer #1' }]);
	expect(tx.member.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ role: 'Backend Developer', teamId: 'team-1' }) }));
	expect(tx.agent.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ model: 'gpt-5', type: 'openai' }) }));
	expect(tx.agentRoleAssignment.create).toHaveBeenCalled();
	expect(tx.activity.create).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ type: 'staffing_changed' }) }));
});

it('invalid Configured Model rolls back by throwing before creating records', async () => {
	const tx: any = {
		project: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1', name: 'Customer Portal', teamId: 'team-1' }) },
		gateway: { findUnique: jest.fn() },
		member: { create: jest.fn() },
	};
	mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

	await expect(applyStaffing('project-1', {
		approved: true,
		hires: [{ name: 'Broken', role: 'Backend Developer', configuredModelId: 'missing' }],
		removals: [],
	})).rejects.toThrow('Configured Model not found');
	expect(tx.member.create).not.toHaveBeenCalled();
});

it('working Agent and Agent with active task cannot be reduced, while idle Agent can move to Bench', async () => {
	const db: any = {
		project: { findUnique: jest.fn().mockResolvedValue(baseStatusProject([
			{ id: 'agent-working', name: 'Working', status: 'working' },
			{ id: 'agent-active', name: 'Active', tasks: [{ id: 'task-1', status: 'in_progress', blocked: false }] },
			{ id: 'agent-idle', name: 'Idle', tasks: [] },
		])) },
		agentRoleAssignment: { findMany: jest.fn().mockResolvedValue([]) },
		roleGroup: { findMany: jest.fn().mockResolvedValue([]) },
	};
	const proposal = await proposeStaffing('project-1', { targetAgentCount: 2 }, db);
	expect(proposal.removals).toEqual([expect.objectContaining({ agentId: 'agent-idle' })]);
	expect(proposal.warnings.join('\n')).toContain('Working is currently working');
	expect(proposal.warnings.join('\n')).toContain('Active owns active tasks');

	const tx: any = {
		project: { findUnique: jest.fn().mockResolvedValue({ id: 'project-1', name: 'Customer Portal', teamId: 'team-1' }) },
		team: { upsert: jest.fn().mockResolvedValue({ id: 'on-bench' }) },
		agent: {
			findUnique: jest.fn().mockResolvedValue({ id: 'agent-idle', name: 'Idle', status: 'idle', member: { teamId: 'team-1' }, tasks: [] }),
			update: jest.fn().mockResolvedValue({}),
		},
		activity: { create: jest.fn().mockResolvedValue({}) },
	};
	mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));
	const result = await applyStaffing('project-1', { approved: true, removals: proposal.removals, hires: [] });
	expect(result.benched).toEqual([{ agentId: 'agent-idle', name: 'Idle' }]);
	expect(tx.agent.update).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ member: { update: { teamId: 'on-bench' } } }) }));
});
