jest.mock('../lib/auth', () => ({
	withAuth: (handler: any) => handler,
}));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		sprint: { findUnique: jest.fn(), update: jest.fn() },
	},
}));

jest.mock('../lib/memory/memory-service', () => ({
	writeSprintSummary: jest.fn(() => Promise.resolve({})),
}));

import planHandler from '../pages/api/sprints/[id]/plan';
import startHandler from '../pages/api/sprints/[id]/start';
import completeHandler from '../pages/api/sprints/[id]/complete';
import prisma from '../lib/prisma';

const mockReq = (method: string, query?: any) => ({
	method,
	query: query || { id: 'sprint_1' },
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

describe('POST /api/sprints/[id]/plan', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('plan returns suggested tasks with capacity warnings', async () => {
		const sprint = {
			id: 'sprint_1',
			name: 'Sprint 1',
			projectId: 'proj_1',
			status: 'planned',
			project: { id: 'proj_1', name: 'Test', team: { id: 'team_1' } },
			tasks: [
				{ id: 't1', title: 'Task A', priority: 'high', storyPoints: 8, blocked: false, createdAt: new Date('2025-01-02') },
				{ id: 't2', title: 'Task B', priority: 'low', storyPoints: 5, blocked: false, createdAt: new Date('2025-01-01') },
				{ id: 't3', title: 'Task C', priority: 'high', storyPoints: 21, blocked: true, createdAt: new Date('2025-01-03') },
			],
		};

		(prisma.sprint.findUnique as jest.Mock).mockResolvedValue(sprint);

		const req = mockReq('POST', { id: 'sprint_1' });
		const res = mockRes();

		await planHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.sprintId).toBe('sprint_1');
		expect(body.suggestedTasks).toHaveLength(3);
		expect(body.suggestedTasks[0].priority).toBe('high');
		expect(body.capacityWarnings.length).toBeGreaterThan(0);
		expect(body.capacityWarnings.some((w: string) => w.includes('story points'))).toBe(true);
		expect(body.capacityWarnings.some((w: string) => w.includes('blocked'))).toBe(true);
	});

	it('returns 404 for non-existent sprint', async () => {
		(prisma.sprint.findUnique as jest.Mock).mockResolvedValue(null);

		const req = mockReq('POST', { id: 'sprint_none' });
		const res = mockRes();

		await planHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(404);
		expect(res.json).toHaveBeenCalledWith({ error: 'Sprint not found' });
	});

	it('returns 400 when sprint id is missing', async () => {
		const req = { query: {}, cookies: { dashboard_session: 'valid.session.token' }, headers: { host: 'localhost:3000', origin: 'http://localhost:3000' }, method: 'POST' };
		const res = mockRes();

		await planHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({ error: 'Sprint id is required' });
	});

	it('returns 405 for non-POST method', async () => {
		const req = { method: 'GET', query: { id: 'sprint_1' }, cookies: { dashboard_session: 'valid.session.token' }, headers: { host: 'localhost:3000', origin: 'http://localhost:3000' } };
		const res = mockRes();

		await planHandler(req as any, res as any);

		expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
		expect(res.status).toHaveBeenCalledWith(405);
	});

	it('returns 500 when prisma throws', async () => {
		(prisma.sprint.findUnique as jest.Mock).mockRejectedValue(new Error('db error'));

		const req = mockReq('POST', { id: 'sprint_1' });
		const res = mockRes();

		await planHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to plan sprint' });
	});

	it('returns no capacity warnings for a small sprint', async () => {
		const sprint = {
			id: 'sprint_1',
			name: 'Small Sprint',
			projectId: 'proj_1',
			status: 'planned',
			project: { id: 'proj_1', name: 'Test', team: { id: 'team_1' } },
			tasks: [
				{ id: 't1', title: 'Task A', priority: 'medium', storyPoints: 3, blocked: false, createdAt: new Date() },
			],
		};

		(prisma.sprint.findUnique as jest.Mock).mockResolvedValue(sprint);

		const req = mockReq('POST', { id: 'sprint_1' });
		const res = mockRes();

		await planHandler(req as any, res as any);

		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.capacityWarnings).toEqual([]);
	});
});

describe('POST /api/sprints/[id]/start', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('start updates status to active', async () => {
		const sprint = {
			id: 'sprint_1',
			name: 'Sprint 1',
			projectId: 'proj_1',
			status: 'planned',
			startDate: new Date(),
			endDate: null,
			tasks: [],
			order: 0,
			project: { id: 'proj_1', name: 'Test' },
		};

		(prisma.sprint.update as jest.Mock).mockResolvedValue(sprint);

		const req = mockReq('POST', { id: 'sprint_1' });
		const res = mockRes();

		await startHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(prisma.sprint.update).toHaveBeenCalledWith({
			where: { id: 'sprint_1' },
			data: { status: 'active', startDate: expect.any(Date) },
		});
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.status).toBe('planned');
	});

	it('returns 400 when sprint id is missing', async () => {
		const req = { query: {}, cookies: { dashboard_session: 'valid.session.token' }, headers: { host: 'localhost:3000', origin: 'http://localhost:3000' }, method: 'POST' };
		const res = mockRes();

		await startHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(400);
	});

	it('returns 500 when prisma throws', async () => {
		(prisma.sprint.update as jest.Mock).mockRejectedValue(new Error('db error'));

		const req = mockReq('POST', { id: 'sprint_1' });
		const res = mockRes();

		await startHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to start sprint' });
	});
});

describe('POST /api/sprints/[id]/complete', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('complete updates status to completed', async () => {
		const sprint = {
			id: 'sprint_1',
			name: 'Sprint 1',
			projectId: 'proj_1',
			status: 'planned',
			goal: 'Do things',
			tasks: [
				{ id: 't1', title: 'Task A', status: 'done' },
				{ id: 't2', title: 'Task B', status: 'in_progress' },
			],
			project: { id: 'proj_1', name: 'Test' },
		};

		(prisma.sprint.findUnique as jest.Mock).mockResolvedValue(sprint);
		(prisma.sprint.update as jest.Mock).mockResolvedValue({ ...sprint, status: 'completed', endDate: new Date() });

		const req = mockReq('POST', { id: 'sprint_1' });
		const res = mockRes();

		await completeHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		expect(prisma.sprint.update).toHaveBeenCalledWith({
			where: { id: 'sprint_1' },
			data: { status: 'completed', endDate: expect.any(Date) },
			include: { project: true, tasks: true },
		});
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.status).toBe('completed');
	});

	it('returns 404 for non-existent sprint', async () => {
		(prisma.sprint.findUnique as jest.Mock).mockResolvedValue(null);

		const req = mockReq('POST', { id: 'sprint_none' });
		const res = mockRes();

		await completeHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(404);
		expect(res.json).toHaveBeenCalledWith({ error: 'Sprint not found' });
	});

	it('writes sprint summary', async () => {
		const sprint = {
			id: 'sprint_1',
			name: 'Sprint 1',
			projectId: 'proj_1',
			goal: 'Do things',
			tasks: [
				{ id: 't1', title: 'Task A', status: 'done' },
				{ id: 't2', title: 'Task B', status: 'in_progress' },
			],
			project: { id: 'proj_1', name: 'Test' },
		};

		(prisma.sprint.findUnique as jest.Mock).mockResolvedValue(sprint);
		(prisma.sprint.update as jest.Mock).mockResolvedValue({ ...sprint, status: 'completed' });

		const req = mockReq('POST', { id: 'sprint_1' });
		const res = mockRes();

		await completeHandler(req as any, res as any);

		const { writeSprintSummary } = require('../lib/memory/memory-service');
		expect(writeSprintSummary).toHaveBeenCalledWith(
			expect.anything(),
			expect.objectContaining({
				sprintId: 'sprint_1',
				projectId: 'proj_1',
				completed: 'Task A',
				incomplete: 'Task B',
			}),
		);
	});

	it('returns 400 when sprint id is missing', async () => {
		const req = { query: {}, cookies: { dashboard_session: 'valid.session.token' }, headers: { host: 'localhost:3000', origin: 'http://localhost:3000' }, method: 'POST' };
		const res = mockRes();

		await completeHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({ error: 'Sprint id is required' });
	});

	it('returns 500 when prisma throws', async () => {
		(prisma.sprint.findUnique as jest.Mock).mockRejectedValue(new Error('db error'));

		const req = mockReq('POST', { id: 'sprint_1' });
		const res = mockRes();

		await completeHandler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to complete sprint' });
	});
});
