import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/tasks/[id]/memory';

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
		taskMemory: { findUnique: jest.fn() },
	},
}));

import prisma from '../lib/prisma';

describe('GET /api/tasks/[id]/memory', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns TaskMemory when it exists', async () => {
		const memory = { id: 'tm-1', taskId: 't1', objective: 'Implement auth', version: 2 };
		(prisma.taskMemory.findUnique as jest.Mock).mockResolvedValue(memory);

		const req = mockReq('GET', 't1');
		req.query = { id: 't1' };
		const res = mockRes();

		await handler(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		const data = (res.json as jest.Mock).mock.calls[0]?.[0];
		expect(data.objective).toBe('Implement auth');
		expect(data.version).toBe(2);
	});

	it('returns 404 when no memory exists', async () => {
		(prisma.taskMemory.findUnique as jest.Mock).mockResolvedValue(null);

		const req = mockReq('GET', 't1');
		req.query = { id: 't1' };
		const res = mockRes();

		await handler(req, res);
		expect(res.status).toHaveBeenCalledWith(404);
		const data = (res.json as jest.Mock).mock.calls[0]?.[0];
		expect(data.error).toContain('No task memory found');
	});
});
