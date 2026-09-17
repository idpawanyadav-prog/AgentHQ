jest.mock('../lib/auth', () => ({
	withAuth: (handler: any) => handler,
}));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		task: { findUnique: jest.fn(), update: jest.fn() },
		agent: { findUnique: jest.fn() },
		activity: { create: jest.fn() },
	},
}));

jest.mock('../lib/memory/memory-service', () => ({
	writeHandoffRecord: jest.fn((_prisma: any, data: any) => Promise.resolve({ id: 'handoff_1', ...data })),
}));

import handler from '../pages/api/tasks/[id]/reassign';
import prisma from '../lib/prisma';

const mockReq = (method: string, body?: any, query?: any) => ({
	method,
	body: body || {},
	query: query || { id: 'task_1' },
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

describe('POST /api/tasks/[id]/reassign', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('verifies agent exists and is available, creates handoff record, updates task agentId, returns reassigned:true', async () => {
		const task = {
			id: 'task_1',
			title: 'Test Task',
			projectId: 'proj_1',
			teamId: 'team_1',
			agentId: 'agent_old',
			status: 'in_progress',
		};
		const agent = { id: 'agent_new', name: 'Available Agent', status: 'idle', member: { id: 'm1', teamId: 'team_1' } };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.agent.findUnique as jest.Mock).mockResolvedValue(agent);
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, agentId: 'agent_new' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', { newAgentId: 'agent_new' }, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.reassigned).toBe(true);
		expect(body.taskId).toBe('task_1');
		expect(body.newAgentId).toBe('agent_new');
		expect(body.handoffId).toBeDefined();
	});

	it('returns reassigned:true', async () => {
		const task = {
			id: 'task_1',
			title: 'Test Task',
			projectId: 'proj_1',
			teamId: 'team_1',
			agentId: 'agent_old',
			status: 'in_progress',
		};
		const agent = { id: 'agent_new', name: 'New Agent', status: 'idle', member: { id: 'm1', teamId: 'team_1' } };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.agent.findUnique as jest.Mock).mockResolvedValue(agent);
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, agentId: 'agent_new' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', { newAgentId: 'agent_new' }, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.reassigned).toBe(true);
		expect(body.newAgentId).toBe('agent_new');
	});

	it('returns 404 for non-existent task', async () => {
		(prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

		const req = mockReq('POST', { newAgentId: 'agent_new' }, { id: 'task_999' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(404);
		expect(res.json).toHaveBeenCalledWith({ error: 'Task not found' });
	});

	it('returns 404 for non-existent agent', async () => {
		const task = {
			id: 'task_1',
			title: 'Test Task',
			projectId: 'proj_1',
			teamId: 'team_1',
			agentId: 'agent_old',
		};
		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.agent.findUnique as jest.Mock).mockResolvedValue(null);

		const req = mockReq('POST', { newAgentId: 'agent_nonexistent' }, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(404);
		expect(res.json).toHaveBeenCalledWith({ error: 'Agent agent_nonexistent not found' });
	});

	it('returns 409 when agent is not available', async () => {
		const task = {
			id: 'task_1',
			title: 'Test Task',
			projectId: 'proj_1',
			teamId: 'team_1',
			agentId: 'agent_old',
		};
		const agent = { id: 'agent_busy', name: 'Busy Agent', status: 'working' };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.agent.findUnique as jest.Mock).mockResolvedValue(agent);

		const req = mockReq('POST', { newAgentId: 'agent_busy' }, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(409);
		expect(res.json).toHaveBeenCalledWith({
			error: expect.stringMatching(/not available.*working/),
		});
	});

	it('returns 400 when newAgentId is missing', async () => {
		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({ error: 'newAgentId is required' });
	});

	it('returns 405 for non-POST method', async () => {
		const req = mockReq('GET', { newAgentId: 'agent_new' }, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
		expect(res.status).toHaveBeenCalledWith(405);
	});

	it('returns 500 when prisma throws', async () => {
		const task = {
			id: 'task_1',
			title: 'Test Task',
			projectId: 'proj_1',
			teamId: 'team_1',
			agentId: 'agent_old',
		};
		const agent = { id: 'agent_new', name: 'New Agent', status: 'idle' };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.agent.findUnique as jest.Mock).mockRejectedValue(new Error('db error'));

		const req = mockReq('POST', { newAgentId: 'agent_new' }, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to reassign task' });
	});
});
