import { mockReq, mockRes } from './test-api';

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		setting: { findUnique: jest.fn() },
		roleGroup: { findMany: jest.fn(), findUnique: jest.fn(), create: jest.fn() },
	},
}));

const mockPrisma = jest.requireMock('../lib/prisma').default;

import rootHandler from '../pages/api/agent-memory';
import pathHandler from '../pages/api/agent-memory/[...path]';

beforeEach(() => {
	jest.clearAllMocks();
	mockPrisma.setting.findUnique.mockResolvedValue({
		value: JSON.stringify({ hash: 'unused', secret: 'secret' }),
	});
});

it.each([
	['GET', undefined, rootHandler],
	['POST', undefined, rootHandler],
	['GET', ['role-groups', 'role-1'], pathHandler],
	['PUT', ['role-groups', 'role-1'], pathHandler],
	['DELETE', ['role-groups', 'role-1'], pathHandler],
	['POST', ['role-groups', 'role-1', 'instructions'], pathHandler],
	['POST', ['role-groups', 'role-1', 'skills'], pathHandler],
	['POST', ['role-groups', 'role-1', 'assignments'], pathHandler],
])('requires auth for %s /api/agent-memory/%s', async (method, path, handler) => {
	const res = mockRes();
	await handler(mockReq({ method: method as string, query: path ? { path } : {} }), res);
	expect(res.status).toHaveBeenCalledWith(401);
});

