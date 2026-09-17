import type { NextApiRequest, NextApiResponse } from 'next';
import handler from '../pages/api/tasks/[id]/checkpoints';

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
		executionRun: { findMany: jest.fn(() => Promise.resolve([])) },
		executionCheckpoint: { findMany: jest.fn(() => Promise.resolve([])) },
	},
}));

import prisma from '../lib/prisma';

describe('GET /api/tasks/[id]/checkpoints', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns checkpoints for a task', async () => {
		(prisma.executionRun.findMany as jest.Mock).mockResolvedValue([{ id: 'run-1' }]);
		(prisma.executionCheckpoint.findMany as jest.Mock).mockResolvedValue([
			{ id: 'cp-1', phase: 'before_execution', createdAt: new Date('2024-01-01') },
			{ id: 'cp-2', phase: 'completed', createdAt: new Date('2024-01-02') },
		]);

		const req = mockReq('GET', 't1');
		req.query = { id: 't1' };
		const res = mockRes();

		await handler(req, res);

		expect(res.status).toHaveBeenCalledWith(200);
		const data = (res.json as jest.Mock).mock.calls[0]?.[0];
		expect(data).toHaveLength(2);
		expect(prisma.executionCheckpoint.findMany).toHaveBeenCalledWith(
			expect.objectContaining({ where: { executionRunId: { in: ['run-1'] } }, orderBy: { createdAt: 'desc' } }),
		);
	});

	it('returns empty array when no runs exist', async () => {
		(prisma.executionRun.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.executionCheckpoint.findMany as jest.Mock).mockResolvedValue([]);

		const req = mockReq('GET', 't1');
		req.query = { id: 't1' };
		const res = mockRes();

		await handler(req, res);
		expect((res.json as jest.Mock).mock.calls[0]?.[0]).toEqual([]);
	});

	it('returns 400 when task id is missing', async () => {
		const req = mockReq('GET');
		req.query = {};
		const res = mockRes();

		await handler(req, res);
		expect(res.status).toHaveBeenCalledWith(400);
	});
});
