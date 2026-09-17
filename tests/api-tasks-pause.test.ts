jest.mock('../lib/auth', () => ({
	withAuth: (handler: any) => handler,
}));

jest.mock('../lib/job-queue', () => ({
	__esModule: true,
	cancelJob: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../lib/memory/memory-service', () => ({
	__esModule: true,
	writeTaskMemory: jest.fn(() => Promise.resolve({})),
	writeHandoffRecord: jest.fn((_prisma: any, data: any) => Promise.resolve({ id: 'handoff_1', ...data })),
}));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		task: { findUnique: jest.fn(), update: jest.fn() },
		executionRun: { findFirst: jest.fn(), update: jest.fn() },
		executionCheckpoint: { create: jest.fn() },
		handoffRecord: { findFirst: jest.fn(), create: jest.fn() },
		agent: { findUnique: jest.fn(), update: jest.fn() },
		activity: { create: jest.fn() },
		taskMemory: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn() },
		projectMemory: { findUnique: jest.fn() },
	},
}));

import handler from '../pages/api/tasks/[id]/pause';
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

describe('POST /api/tasks/[id]/pause', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	const baseTask = (overrides: Record<string, unknown> = {}) => ({
		id: 'task_1',
		title: 'Test Task',
		projectId: 'proj_1',
		teamId: 'team_1',
		agentId: 'agent_1',
		status: 'in_progress',
		...overrides,
	});

	it('creates checkpoint, handoff, updates task to paused', async () => {
		const task = baseTask();
		const activeRun = {
			id: 'run_1',
			taskId: 'task_1',
			projectId: 'proj_1',
			agentId: 'agent_1',
			jobId: 'job_1',
			status: 'running',
		};

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.executionRun.findFirst as jest.Mock).mockResolvedValue(activeRun);
		(prisma.executionCheckpoint.create as jest.Mock).mockResolvedValue({
			id: 'chk_1',
			executionRunId: 'run_1',
			phase: 'paused',
			taskStatus: 'paused',
			agentStatus: 'idle',
			metadata: '{}',
			createdAt: new Date(),
		});
		(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(null);
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'paused' });
		(prisma.agent.update as jest.Mock).mockResolvedValue({ id: 'agent_1', status: 'idle' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.paused).toBe(true);
		expect(body.taskId).toBe('task_1');
		expect(body.checkpointId).toBe('chk_1');
		expect(body.handoffId).toBeDefined();
	});

	it('returns paused:true with checkpointId and handoffId', async () => {
		const task = baseTask();
		const activeRun = {
			id: 'run_1',
			taskId: 'task_1',
			projectId: 'proj_1',
			agentId: null,
			jobId: null,
			status: 'running',
		};

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.executionRun.findFirst as jest.Mock).mockResolvedValue(activeRun);
		(prisma.executionCheckpoint.create as jest.Mock).mockResolvedValue({
			id: 'chk_99',
			createdAt: new Date(),
		});
		(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(null);
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'paused' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.paused).toBe(true);
		expect(body.checkpointId).toBe('chk_99');
		expect(body.handoffId).toBeDefined();
	});

	it('returns 404 for non-existent task', async () => {
		(prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

		const req = mockReq('POST', {}, { id: 'task_999' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(404);
		expect(res.json).toHaveBeenCalledWith({ error: 'Task not found' });
	});

	it('handles task with no active execution run', async () => {
		const task = baseTask();
		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.executionRun.findFirst as jest.Mock).mockResolvedValue(null);
		(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(null);
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'paused' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.paused).toBe(true);
		expect(body.checkpointId).toBeNull();
		expect(body.handoffId).toBeDefined();
		expect(prisma.executionCheckpoint.create).not.toHaveBeenCalled();
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
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to pause task' });
	});

	it('does not cancel job when activeRun has no jobId', async () => {
		const task = baseTask();
		const activeRun = { id: 'run_1', taskId: 'task_1', status: 'running', jobId: null };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.executionRun.findFirst as jest.Mock).mockResolvedValue(activeRun);
		(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(null);
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'paused' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
	});

	it('sets agent to idle when task has agentId', async () => {
		const task = baseTask();
		const activeRun = { id: 'run_1', taskId: 'task_1', status: 'running', jobId: null };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.executionRun.findFirst as jest.Mock).mockResolvedValue(activeRun);
		(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(null);
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'paused' });
		(prisma.agent.update as jest.Mock).mockResolvedValue({ id: 'agent_1', status: 'idle' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(prisma.agent.update).toHaveBeenCalledWith({
			where: { id: 'agent_1' },
			data: { status: 'idle' },
		});
	});

	it('does not update agent when task has no agentId', async () => {
		const task = baseTask({ agentId: null });
		const activeRun = { id: 'run_1', taskId: 'task_1', status: 'running', jobId: null };

		(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
		(prisma.executionRun.findFirst as jest.Mock).mockResolvedValue(activeRun);
		(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(null);
		(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'paused' });
		(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

		const req = mockReq('POST', {}, { id: 'task_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(prisma.agent.update).not.toHaveBeenCalled();
	});
});
