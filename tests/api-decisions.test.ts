jest.mock('../lib/auth', () => ({
	withAuth: (handler: any) => handler,
}));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		decisionRecord: { findMany: jest.fn() },
	},
}));

import handler from '../pages/api/projects/[id]/decisions';
import prisma from '../lib/prisma';

const mockReq = (method: string, query?: any) => ({
	method,
	query: query || { id: 'proj_1' },
	cookies: { dashboard_session: 'valid.session.token' },
	headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
});

const mockRes = () => {
	const res: any = {};
	res.status = jest.fn(() => res);
	res.json = jest.fn(() => res);
	res.setHeader = jest.fn();
	res.end = jest.fn();
	return res;
};

describe('GET /api/projects/[id]/decisions', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns active decisions', async () => {
		const decisions = [
			{
				id: 'dec_1',
				projectId: 'proj_1',
				taskId: null,
				title: 'Use Prisma',
				decision: 'Use Prisma as ORM',
				rationale: 'Type safety',
				status: 'active',
				createdAt: new Date(),
			},
			{
				id: 'dec_2',
				projectId: 'proj_1',
				taskId: null,
				title: 'Use Next.js',
				decision: 'Use Next.js for frontend',
				status: 'active',
				createdAt: new Date(),
			},
		];

		(prisma.decisionRecord.findMany as jest.Mock).mockResolvedValue(decisions);

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body).toHaveLength(2);
		expect(body[0].status).toBe('active');
		expect(body[1].title).toBe('Use Next.js');
	});

	it('filters by taskId when provided', async () => {
		const decisions = [
			{
				id: 'dec_1',
				projectId: 'proj_1',
				taskId: 'task_1',
				title: 'Task Decision',
				decision: 'Use MongoDB for this task',
				status: 'active',
				createdAt: new Date(),
			},
		];

		(prisma.decisionRecord.findMany as jest.Mock).mockResolvedValue(decisions);

		const req = mockReq('GET', { id: 'proj_1', taskId: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(prisma.decisionRecord.findMany).toHaveBeenCalledWith({
			where: {
				projectId: 'proj_1',
				status: 'active',
				taskId: 'task_1',
			},
			orderBy: { createdAt: 'desc' },
		});
		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body).toHaveLength(1);
		expect(body[0].taskId).toBe('task_1');
	});

	it('returns 405 for non-GET method', async () => {
		const req = mockReq('POST', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET']);
		expect(res.status).toHaveBeenCalledWith(405);
	});

	it('returns 400 when project id is missing', async () => {
		const req = mockReq('GET', {});
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({ error: 'Project id is required' });
	});

	it('returns empty array when no decisions exist', async () => {
		(prisma.decisionRecord.findMany as jest.Mock).mockResolvedValue([]);

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(res.json).toHaveBeenCalledWith([]);
	});

	it('returns 500 when prisma throws', async () => {
		(prisma.decisionRecord.findMany as jest.Mock).mockRejectedValue(new Error('db error'));

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch decisions' });
	});
});
