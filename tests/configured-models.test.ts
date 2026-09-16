import { mockReq, mockRes } from './test-api';

jest.mock('../lib/auth', () => ({ withAuth: (handler: unknown) => handler }));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		setting: {
			findUnique: jest.fn(),
			upsert: jest.fn(),
		},
		gateway: {
			findUnique: jest.fn(),
		},
		agent: {
			findMany: jest.fn(),
			update: jest.fn(),
		},
	},
}));

const mockPrisma = jest.requireMock('../lib/prisma').default;

import handler from '../pages/api/models';

let storedModels: any[] = [];

beforeEach(() => {
	jest.clearAllMocks();
	storedModels = [];
	mockPrisma.setting.findUnique.mockImplementation(async () => (
		storedModels.length ? { value: JSON.stringify(storedModels) } : null
	));
	mockPrisma.setting.upsert.mockImplementation(async ({ create, update }: any) => {
		storedModels = JSON.parse(update?.value || create.value);
		return { value: JSON.stringify(storedModels) };
	});
	mockPrisma.gateway.findUnique.mockResolvedValue({
		id: 'gw-1',
		name: 'Primary Gateway',
		provider: 'openai',
		model: 'gpt-4o',
	});
	mockPrisma.agent.findMany.mockResolvedValue([]);
	mockPrisma.agent.update.mockImplementation(async ({ data }: any) => data);
});

it('creates a configured model from server-derived gateway metadata', async () => {
	const res = mockRes();
	await handler(mockReq({
		method: 'POST',
		body: { name: 'Fast Model', gatewayId: 'gw-1', gatewayName: 'Fake', provider: 'anthropic', modelId: 'gpt-5' },
	}), res);

	expect(res.status).toHaveBeenCalledWith(201);
	expect((res.body as any).provider).toBe('openai');
	expect((res.body as any).gatewayName).toBe('Primary Gateway');
	expect((res.body as any).modelId).toBe('gpt-5');
});

it('rejects an invalid gateway', async () => {
	mockPrisma.gateway.findUnique.mockResolvedValue(null);
	const res = mockRes();
	await handler(mockReq({ method: 'POST', body: { name: 'Broken', gatewayId: 'missing', modelId: 'gpt-5' } }), res);
	expect(res.status).toHaveBeenCalledWith(404);
});

it('updates assigned agents when a configured model changes', async () => {
	storedModels = [{
		id: 'model-1',
		name: 'Old',
		gatewayId: 'gw-1',
		gatewayName: 'Primary Gateway',
		provider: 'openai',
		modelId: 'gpt-4o',
		createdAt: new Date().toISOString(),
		updatedAt: new Date().toISOString(),
	}];
	mockPrisma.agent.findMany.mockResolvedValue([
		{ id: 'agent-1', name: 'Agent', type: 'openai', model: 'gpt-4o', config: JSON.stringify({ configuredModelId: 'model-1' }) },
	]);

	const res = mockRes();
	await handler(mockReq({ method: 'PUT', body: { id: 'model-1', name: 'New', gatewayId: 'gw-1', modelId: 'gpt-5' } }), res);

	expect(res.status).toHaveBeenCalledWith(200);
	expect(mockPrisma.agent.update).toHaveBeenCalledWith(expect.objectContaining({
		where: { id: 'agent-1' },
		data: expect.objectContaining({ type: 'openai', model: 'gpt-5' }),
	}));
});

it('deletes unused models and rejects assigned models', async () => {
	storedModels = [{ id: 'model-1', name: 'Model', gatewayId: 'gw-1', gatewayName: 'Gateway', provider: 'openai', modelId: 'gpt-5' }];

	const deleteUnused = mockRes();
	await handler(mockReq({ method: 'DELETE', body: { id: 'model-1' } }), deleteUnused);
	expect(deleteUnused.status).toHaveBeenCalledWith(204);

	storedModels = [{ id: 'model-1', name: 'Model', gatewayId: 'gw-1', gatewayName: 'Gateway', provider: 'openai', modelId: 'gpt-5' }];
	mockPrisma.agent.findMany.mockResolvedValue([{ name: 'Assigned', config: JSON.stringify({ configuredModelId: 'model-1' }) }]);
	const deleteAssigned = mockRes();
	await handler(mockReq({ method: 'DELETE', body: { id: 'model-1' } }), deleteAssigned);
	expect(deleteAssigned.status).toHaveBeenCalledWith(409);
});

