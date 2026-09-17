import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/agents/[id]/memory';

const mockReq = (method: string, queryId?: string): NextApiRequest =>
	({
		method,
		query: queryId ? { id: queryId } : {},
		cookies: { dashboard_session: 's' },
		headers: { host: 'localhost' },
	} as any);

const mockRes = (): NextApiResponse => {
	const res = { status: jest.fn(() => res), json: jest.fn(() => res), setHeader: jest.fn() } as unknown as NextApiResponse;
	return res;
};

jest.mock('../lib/auth', () => ({ withAuth: (h: any) => h }));
jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		agentMemory: { findMany: jest.fn() },
	},
}));

import prisma from '../lib/prisma';

describe('GET /api/agents/[id]/memory', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns agent memory entries for an agent', async () => {
		(prisma.agentMemory.findMany as jest.Mock).mockResolvedValue([
			{ id: 'am-1', agentId: 'a1', category: 'lesson', content: 'Always run tests first' },
			{ id: 'am-2', agentId: 'a1', category: 'failure', content: 'Forgot to commit changes' },
		]);

		const req = mockReq('GET', 'a1');
		req.query = { id: 'a1' };
		const res = mockRes();

		await handler(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		const data = (res.json as jest.Mock).mock.calls[0]?.[0];
		expect(data).toHaveLength(2);
		expect(prisma.agentMemory.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { agentId: 'a1' }, orderBy: { createdAt: 'desc' } }),
		);
	});

	it('returns empty array when no memory entries exist', async () => {
		(prisma.agentMemory.findMany as jest.Mock).mockResolvedValue([]);

		const req = mockReq('GET', 'a1');
		req.query = { id: 'a1' };
		const res = mockRes();

		await handler(req, res);
		expect((res.json as jest.Mock).mock.calls[0]?.[0]).toEqual([]);
	});
});
