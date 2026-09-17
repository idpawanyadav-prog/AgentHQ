jest.mock('../lib/auth', () => ({
	withAuth: (handler: any) => handler,
}));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		task: { findUnique: jest.fn(), update: jest.fn() },
		agent: { findUnique: jest.fn() },
		projectMemory: { findUnique: jest.fn() },
		taskMemory: { findUnique: jest.fn() },
		executionCheckpoint: { findMany: jest.fn() },
		handoffRecord: { findMany: jest.fn(), create: jest.fn() },
		executionRun: { create: jest.fn() },
		activity: { create: jest.fn() },
	},
}));

jest.mock('../lib/memory/memory-service', () => ({
	__esModule: true,
	writeTaskMemory: jest.fn(() => Promise.resolve({})),
}));

import handler from '../pages/api/tasks/[id]/resume';
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

describe('POST /api/tasks/[id]/resume', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const baseTask = (overrides: Record<string, unknown> = {}) => ({
		id: 'task_1',
		title: 'Test Task',
		projectId: 'proj_1',
		teamId: 'team_1',
		agentId: null,
		status: 'paused',
		...overrides,
	});

	it('loads memory context, creates new execution run, updates task to in_progress, creates handoff record', async () => {
		const task = baseTask();
		const newRun = { id: 'run_new', taskId: 'task_1', projectId: 'proj_1', agentId: null, status: 'queued' };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.projectMemory.findUnique as jest.Mock).mockResolvedValue({
			projectId: 'proj_1',
			mission: 'Build something',
			updatedAt: new Date(),
		});
		(prisma.taskMemory.findUnique as jest.Mock).mockResolvedValue({
			taskId: 'task_1',
			objective: 'Do the thing',
			updatedAt: new Date(),
		});
		(prisma.executionCheckpoint.findMany as jest.Mock).mockResolvedValue([
			{ id: 'chk_1', phase: 'paused', taskStatus: 'paused', agentStatus: 'idle', metadata: '{}', createdAt: new Date() },
		]);
		(prisma.handoffRecord.findMany as jest.Mock).mockResolvedValue([
			{ id: 'ho_1', fromAgentId: 'agent_old', toAgentId: null, createdAt: new Date() },
		]);
		(prisma.executionRun.create as jest.Mock).mockResolvedValue(newRun);
		(prisma.handoffRecord.create as jest.Mock).mockResolvedValue({ id: 'handoff_1', type: 'task_resume' });
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'in_progress' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.resumed).toBe(true);
		expect(body.taskId).toBe('task_1');
		expect(body.executionRunId).toBe('run_new');
		expect(body.handoffId).toBe('handoff_1');
		expect(body.context).toBeDefined();
		expect(body.context.projectMemory).toBeDefined();
		expect(body.context.taskMemory).toBeDefined();
		expect(body.context.previousCheckpoint).toBeDefined();
		expect(body.context.previousHandoff).toBeDefined();
	});

	it('returns resumed:true with executionRunId', async () => {
		const task = baseTask();
		const newRun = { id: 'run_new_2', taskId: 'task_1', projectId: 'proj_1', agentId: null, status: 'queued' };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.projectMemory.findUnique as jest.Mock).mockResolvedValue(null);
		(prisma.taskMemory.findUnique as jest.Mock).mockResolvedValue(null);
		(prisma.executionCheckpoint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.handoffRecord.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.executionRun.create as jest.Mock).mockResolvedValue(newRun);
		(prisma.handoffRecord.create as jest.Mock).mockResolvedValue({ id: 'handoff_2', type: 'task_resume' });
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'in_progress' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.resumed).toBe(true);
		expect(body.executionRunId).toBe('run_new_2');
		expect(body.context.projectMemory).toBeNull();
		expect(body.context.taskMemory).toBeNull();
		expect(body.context.previousCheckpoint).toBeNull();
		expect(body.context.previousHandoff).toBeNull();
	});

	it('test with specific agent', async () => {
		const task = baseTask();
		const agent = { id: 'agent_2', name: 'Resume Agent', status: 'idle' };
		const newRun = { id: 'run_agent', taskId: 'task_1', projectId: 'proj_1', agentId: 'agent_2', status: 'queued' };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.agent.findUnique as jest.Mock).mockResolvedValue(agent);
		(prisma.projectMemory.findUnique as jest.Mock).mockResolvedValue(null);
		(prisma.taskMemory.findUnique as jest.Mock).mockResolvedValue(null);
		(prisma.executionCheckpoint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.handoffRecord.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.executionRun.create as jest.Mock).mockResolvedValue(newRun);
		(prisma.handoffRecord.create as jest.Mock).mockResolvedValue({ id: 'handoff_3', type: 'task_resume' });
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'in_progress' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', { agentId: 'agent_2' }, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.resumed).toBe(true);
		expect(body.context.agentId).toBe('agent_2');
		expect(prisma.task.update).toHaveBeenCalledWith({
			where: { id: 'task_1' },
			data: { status: 'in_progress', agentId: 'agent_2' },
		});
	});

	it('test with no agent specified', async () => {
		const task = baseTask();
		const newRun = { id: 'run_no_agent', taskId: 'task_1', projectId: 'proj_1', agentId: null, status: 'queued' };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.projectMemory.findUnique as jest.Mock).mockResolvedValue(null);
		(prisma.taskMemory.findUnique as jest.Mock).mockResolvedValue(null);
		(prisma.executionCheckpoint.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.handoffRecord.findMany as jest.Mock).mockResolvedValue([]);
		(prisma.executionRun.create as jest.Mock).mockResolvedValue(newRun);
		(prisma.handoffRecord.create as jest.Mock).mockResolvedValue({ id: 'handoff_4', type: 'task_resume' });
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'in_progress' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.resumed).toBe(true);
		expect(body.context.agentId).toBeNull();
	});

	it('returns 404 for non-existent task', async () => {
		(prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

		const req = mockReq('POST', {}, { id: 'task_999' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(404);
		expect(res.json).toHaveBeenCalledWith({ error: 'Task not found' });
	});

	it('returns 405 for non-POST method', async () => {
		const req = mockReq('GET', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
		expect(res.status).toHaveBeenCalledWith(405);
	});

	it('returns 500 when prisma throws', async () => {
		(prisma.task.findUnique as jest.Mock).mockRejectedValue(new Error('db error'));

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to resume task' });
	});
});
