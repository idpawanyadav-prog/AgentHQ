jest.mock('../lib/auth', () => ({
	withAuth: (handler: any) => handler,
}));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		project: { findUnique: jest.fn() },
		task: { findMany: jest.fn(), groupBy: jest.fn(), count: jest.fn() },
		sprint: { findMany: jest.fn(), findFirst: jest.fn() },
		agent: { count: jest.fn() },
	},
}));

import handler from '../pages/api/projects/[id]/delivery-state';
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

describe('GET /api/projects/[id]/delivery-state', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns delivery state with phase, taskCounts, agentCount', async () => {
		const project = { id: 'proj_1', name: 'Test Project', status: 'active', teamId: 'team_1' };

		(prisma.project.findUnique as jest.Mock).mockResolvedValue(project);
		(prisma.task.groupBy as jest.Mock).mockResolvedValue([
			{ status: 'backlog', _count: { _all: 5 } },
			{ status: 'in_progress', _count: { _all: 3 } },
			{ status: 'done', _count: { _all: 10 } },
			{ status: 'blocked', _count: { _all: 2 } },
		]);
		(prisma.task.count as jest.Mock).mockResolvedValue(0);
		(prisma.sprint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.agent.count as jest.Mock).mockResolvedValue(4);

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.projectId).toBe('proj_1');
		expect(body.status).toBe('active');
		expect(body.phase).toBeDefined();
		expect(body.taskCounts.backlog).toBe(5);
		expect(body.taskCounts.in_progress).toBe(3);
		expect(body.taskCounts.done).toBe(10);
		expect(body.agentCount).toBe(4);
		expect(body.blockedCount).toBe(2);
		expect(Array.isArray(body.risks)).toBe(true);
	});

	it('handles missing project', async () => {
		(prisma.project.findUnique as jest.Mock).mockResolvedValue(null);

		const req = mockReq('GET', { id: 'proj_none' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(404);
		expect(res.json).toHaveBeenCalledWith({ error: 'Project not found' });
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

	it('returns 500 when prisma throws', async () => {
		(prisma.project.findUnique as jest.Mock).mockRejectedValue(new Error('db error'));

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to compute delivery state' });
	});

	it('detects blocked phase when tasks are blocked', async () => {
		const project = { id: 'proj_1', name: 'Blocked Project', status: 'active', teamId: 'team_1' };

		(prisma.project.findUnique as jest.Mock).mockResolvedValue(project);
		(prisma.task.groupBy as jest.Mock).mockResolvedValue([
			{ status: 'blocked', _count: { _all: 3 } },
		]);
		(prisma.task.count as jest.Mock).mockResolvedValue(0);
		(prisma.sprint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.agent.count as jest.Mock).mockResolvedValue(0);

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.phase).toBe('blocked');
		expect(body.risks.some((r: string) => r.includes('blocked'))).toBe(true);
	});

	it('detects completed phase when all tasks are done', async () => {
		const project = { id: 'proj_1', name: 'Done Project', status: 'active', teamId: 'team_1' };

		(prisma.project.findUnique as jest.Mock).mockResolvedValue(project);
		(prisma.task.groupBy as jest.Mock).mockResolvedValue([
			{ status: 'done', _count: { _all: 10 } },
		]);
		(prisma.task.count as jest.Mock).mockResolvedValue(0);
		(prisma.sprint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.agent.count as jest.Mock).mockResolvedValue(2);

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.phase).toBe('completed');
	});

	it('detects no risks when healthy project', async () => {
		const project = { id: 'proj_1', name: 'Healthy Project', status: 'active', teamId: 'team_1' };

		(prisma.project.findUnique as jest.Mock).mockResolvedValue(project);
		(prisma.task.groupBy as jest.Mock).mockResolvedValue([
			{ status: 'in_progress', _count: { _all: 3 } },
		]);
		(prisma.task.count as jest.Mock).mockResolvedValue(0);
		(prisma.sprint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.agent.count as jest.Mock).mockResolvedValue(3);

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.risks).toEqual([]);
	});
});
