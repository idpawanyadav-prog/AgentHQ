jest.mock('../lib/auth', () => ({
	withAuth: (handler: any) => handler,
}));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		project: { findMany: jest.fn() },
		team: { findMany: jest.fn() },
		sprint: { findMany: jest.fn() },
		agent: { findMany: jest.fn() },
		task: { findMany: jest.fn() },
		executionRun: { findMany: jest.fn() },
		activity: { findMany: jest.fn() },
	},
}));

import handler from '../pages/api/agent-office/context';
import prisma from '../lib/prisma';

const mockReq = (method: string, query?: any) => ({
	method,
	query: query || {},
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

describe('GET /api/agent-office/context', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns full context', async () => {
		const projects = [{ id: 'proj_1', name: 'Test', teamId: 'team_1', updatedAt: new Date(), team: { id: 'team_1' } }];
		const teams = [{ id: 'team_1', name: 'Team' }];
		const sprints = [{ id: 'spr_1', name: 'Sprint 1', projectId: 'proj_1', project: { id: 'proj_1' }, _count: { tasks: 3 }, createdAt: new Date() }];
		const agents = [{ id: 'ag_1', name: 'Agent', status: 'idle', member: { id: 'm1', teamId: 'team_1' }, createdAt: new Date() }];
		const tasks = [{ id: 't_1', title: 'Task', projectId: 'proj_1', project: { id: 'proj_1' }, sprint: { id: 'spr_1', name: 'Sprint 1', status: 'active' }, updatedAt: new Date() }];
		const executions = [{ id: 'ex_1', projectId: 'proj_1', project: { id: 'proj_1' }, createdAt: new Date() }];
		const blockers = [];
		const activities = [{ id: 'act_1', type: 'task_assigned', description: 'Assigned', teamId: 'team_1', createdAt: new Date() }];

		(prisma.project.findMany as jest.Mock).mockResolvedValue(projects);
		(prisma.team.findMany as jest.Mock).mockResolvedValue(teams);
		(prisma.sprint.findMany as jest.Mock).mockResolvedValue(sprints);
		(prisma.agent.findMany as jest.Mock).mockResolvedValue(agents);
		(prisma.task.findMany as jest.Mock)
			.mockResolvedValueOnce(tasks)
			.mockResolvedValueOnce(blockers);
		(prisma.executionRun.findMany as jest.Mock).mockResolvedValue(executions);
		(prisma.activity.findMany as jest.Mock).mockResolvedValue(activities);

		const req = mockReq('GET', {});
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.projects).toHaveLength(1);
		expect(body.teams).toHaveLength(1);
		expect(body.sprints).toHaveLength(1);
		expect(body.agents).toHaveLength(1);
		expect(body.tasks).toHaveLength(1);
		expect(body.executions).toHaveLength(1);
		expect(body.blockers).toHaveLength(0);
		expect(body.recentActivities).toHaveLength(1);
	});

	it('filters by projectId', async () => {
		(prisma.project.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.team.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.sprint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.agent.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.task.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.executionRun.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.activity.findMany as jest.Mock).mockResolvedValue([]);

		const req = mockReq('GET', { projectId: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(prisma.project.findMany).toHaveBeenCalledWith({
			where: { id: 'proj_1' },
			include: { team: true },
			orderBy: { updatedAt: 'desc' },
		});
		expect(prisma.sprint.findMany).toHaveBeenCalledWith({
			where: { id: 'proj_1' },
			include: { project: true, _count: { select: { tasks: true } } },
			orderBy: { createdAt: 'desc' },
		});
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it('filters by teamId', async () => {
		(prisma.project.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.team.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.sprint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.agent.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.task.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.executionRun.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.activity.findMany as jest.Mock).mockResolvedValue([]);

		const req = mockReq('GET', { teamId: 'team_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(prisma.project.findMany).toHaveBeenCalledWith({
			where: { teamId: 'team_1' },
			include: { team: true },
			orderBy: { updatedAt: 'desc' },
		});
		expect(prisma.agent.findMany).toHaveBeenCalledWith({
			where: { member: { teamId: 'team_1' } },
			include: { member: true },
			orderBy: { createdAt: 'desc' },
		});
		expect(res.status).toHaveBeenCalledWith(200);
	});

	it('filters blockers by project', async () => {
		const blockers = [{ id: 't_b1', blocked: true, projectId: 'proj_1', project: { id: 'proj_1' }, updatedAt: new Date() }];

		(prisma.project.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.team.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.sprint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.agent.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.task.findMany as jest.Mock)
			.mockResolvedValueOnce([])
			.mockResolvedValueOnce(blockers);
		(prisma.executionRun.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.activity.findMany as jest.Mock).mockResolvedValue([]);

		const req = mockReq('GET', { projectId: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.blockers).toHaveLength(1);
	});

	it('returns 500 when prisma throws', async () => {
		(prisma.project.findMany as jest.Mock).mockRejectedValue(new Error('db error'));

		const req = mockReq('GET', {});
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to load agent office context' });
	});
});
