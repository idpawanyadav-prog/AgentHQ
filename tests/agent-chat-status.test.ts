import { mockReq, mockRes } from './test-api';

jest.mock('../lib/auth', () => ({ withAuth: (handler: unknown) => handler }));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		agent: {
			findUnique: jest.fn(),
			update: jest.fn(),
		},
		gateway: {
			findUnique: jest.fn(),
			findFirst: jest.fn(),
		},
		activity: {
			create: jest.fn(),
		},
	},
}));

const mockPrisma = jest.requireMock('../lib/prisma').default;
jest.mock('../lib/secrets', () => ({ decrypt: jest.fn(() => 'key') }));
jest.mock('../lib/safe-fetch', () => ({ safeFetch: jest.fn() }));
jest.mock('../lib/ssrf-guard', () => ({ parseSafeUrl: jest.fn(async (url: string) => ({ url: new URL(url) })) }));
jest.mock('../lib/configured-models', () => ({
	resolveAgentModel: jest.fn(async () => ({
		config: {},
		configuredModel: { id: 'model-1', provider: 'openai' },
		gatewayId: 'gw-1',
		modelId: 'gpt-5',
		provider: 'openai',
	})),
}));
jest.mock('../lib/agent-context', () => ({ buildAgentSystemPrompt: jest.fn(async () => 'System prompt') }));

import { safeFetch } from '../lib/safe-fetch';
import handler from '../pages/api/agents/[id]/chat';

async function chatWithInitialStatus(status: string, ok = true) {
	mockPrisma.agent.findUnique.mockResolvedValue({ id: 'agent-1', name: 'Ada', memberId: 'member-1', member: { role: 'Developer', teamId: 'team-1' }, status });
	mockPrisma.gateway.findUnique.mockResolvedValue({ id: 'gw-1', provider: 'openai', apiKey: 'encrypted', baseUrl: null });
	mockPrisma.activity.create.mockResolvedValue({});
	(safeFetch as jest.Mock).mockResolvedValue(ok
		? { ok: true, json: async () => ({ choices: [{ message: { content: 'hello' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } }) }
		: { ok: false, status: 500 });

	const res = mockRes();
	await handler(mockReq({ method: 'POST', query: { id: 'agent-1' }, body: { message: 'Hi' } }), res);
	return res;
}

beforeEach(() => {
	jest.clearAllMocks();
});

it('does not overwrite working status after successful chat', async () => {
	const res = await chatWithInitialStatus('working', true);
	expect(res.statusCode).toBe(200);
	expect(mockPrisma.agent.update).not.toHaveBeenCalled();
});

it('does not overwrite working status after failed chat', async () => {
	const res = await chatWithInitialStatus('working', false);
	expect(res.status).toHaveBeenCalledWith(500);
	expect(mockPrisma.agent.update).not.toHaveBeenCalled();
});

it('does not overwrite idle or error status after chat', async () => {
	await chatWithInitialStatus('idle', true);
	await chatWithInitialStatus('error', true);
	expect(mockPrisma.agent.update).not.toHaveBeenCalled();
});

