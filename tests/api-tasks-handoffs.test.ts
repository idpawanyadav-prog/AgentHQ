import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/tasks/[id]/handoffs';

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
		handoffRecord: { findMany: jest.fn(() => Promise.resolve([])) },
	},
}));

import prisma from '../lib/prisma';

describe('GET /api/tasks/[id]/handoffs', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns handoffs for a task', async () => {
		// Mock returns in desc order (newest first) to match orderBy: createdAt desc
		(prisma.handoffRecord.findMany as jest.Mock).mockResolvedValue([
			{ id: 'h2', type: 'task_resume', summary: 'Resumed', createdAt: new Date('2024-01-02') },
			{ id: 'h1', type: 'task_pause', summary: 'Paused', createdAt: new Date('2024-01-01') },
		]);

		const req = mockReq('GET', 't1');
		req.query = { id: 't1' };
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const data = (res.json as jest.Mock).mock.calls[0][0];
		expect(data).toHaveLength(2);
		expect(data[0].id).toBe('h2'); // newest first (desc order)
		expect(prisma.handoffRecord.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { taskId: 't1' }, orderBy: { createdAt: 'desc' } }),
		);
	});

	it('returns empty array when no handoffs exist', async () => {
		(prisma.handoffRecord.findMany as jest.Mock).mockResolvedValue([]);

		const req = mockReq('GET', 't1');
		req.query = { id: 't1' };
		const res = mockRes();

		await handler(req as any, res as any);
		expect((res.json as jest.Mock).mock.calls[0][0]).toEqual([]);
	});

	it('returns 400 when task id is missing', async () => {
		const req = mockReq('GET');
		req.query = {};
		const res = mockRes();

		await handler(req as any, res as any);
		expect(res.status).toHaveBeenCalledWith(400);
	});
});
