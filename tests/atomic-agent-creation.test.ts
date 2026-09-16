import { mockReq, mockRes } from './test-api';

jest.mock('../lib/auth', () => ({ withAuth: (handler: unknown) => handler }));
jest.mock('../lib/configured-models', () => ({
	readConfiguredModels: jest.fn(),
}));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		gateway: { findUnique: jest.fn() },
		$transaction: jest.fn(),
	},
}));

const mockPrisma = jest.requireMock('../lib/prisma').default;

import { readConfiguredModels } from '../lib/configured-models';
import handler from '../pages/api/agents';

const model = {
	id: 'model-1',
	name: 'Coding',
	gatewayId: 'gw-1',
	gatewayName: 'Gateway',
	provider: 'openai',
	modelId: 'gpt-5',
	createdAt: new Date().toISOString(),
	updatedAt: new Date().toISOString(),
};

function makeTx({ roleGroupExists = true, teamExists = true } = {}) {
	return {
		member: {
			findUnique: jest.fn(),
			create: jest.fn(async ({ data }: any) => ({ id: 'member-1', ...data })),
		},
		team: {
			findUnique: jest.fn(async () => teamExists ? { id: 'team-1' } : null),
		},
		roleGroup: {
			findUnique: jest.fn(async () => roleGroupExists ? { id: 'role-1' } : null),
		},
		agent: {
			create: jest.fn(async ({ data }: any) => ({ id: 'agent-1', ...data })),
		},
		agentRoleAssignment: {
			create: jest.fn(async ({ data }: any) => ({ id: 'assignment-1', ...data })),
		},
	};
}

beforeEach(() => {
	jest.clearAllMocks();
	(readConfiguredModels as jest.Mock).mockResolvedValue([model]);
	mockPrisma.gateway.findUnique.mockResolvedValue({ id: 'gw-1' });
});

it('rolls back when the role group is invalid', async () => {
	const tx = makeTx({ roleGroupExists: false });
	mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

	const res = mockRes();
	await handler(mockReq({ method: 'POST', body: { name: 'Agent', teamId: 'team-1', configuredModelId: 'model-1', roleGroupId: 'missing' } }), res);

	expect(res.status).toHaveBeenCalledWith(400);
	expect(tx.agent.create).not.toHaveBeenCalled();
	expect(tx.agentRoleAssignment.create).not.toHaveBeenCalled();
});

it('rejects invalid configured models before creating records', async () => {
	(readConfiguredModels as jest.Mock).mockResolvedValue([]);
	const res = mockRes();

	await handler(mockReq({ method: 'POST', body: { name: 'Agent', teamId: 'team-1', configuredModelId: 'missing' } }), res);

	expect(res.status).toHaveBeenCalledWith(400);
	expect(mockPrisma.$transaction).not.toHaveBeenCalled();
});

it('creates member, agent, and role assignment together', async () => {
	const tx = makeTx();
	mockPrisma.$transaction.mockImplementation(async (callback: any) => callback(tx));

	const res = mockRes();
	await handler(mockReq({ method: 'POST', body: { name: 'Agent', teamId: 'team-1', configuredModelId: 'model-1', roleGroupId: 'role-1' } }), res);

	expect(res.status).toHaveBeenCalledWith(201);
	expect(tx.member.create).toHaveBeenCalled();
	expect(tx.agent.create).toHaveBeenCalled();
	expect(tx.agentRoleAssignment.create).toHaveBeenCalledWith({
		data: expect.objectContaining({ roleGroupId: 'role-1', agentId: 'agent-1' }),
	});
});

