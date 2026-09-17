import { pauseTaskTool } from '../lib/agent-tools/tools/pause-task';
import { proposeResumeTaskTool } from '../lib/agent-tools/tools/propose-resume-task';
import { proposeReassignTool } from '../lib/agent-tools/tools/propose-reassign';

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		task: { findUnique: jest.fn(), update: jest.fn() },
		agent: { findUnique: jest.fn(), update: jest.fn() },
		executionRun: { findFirst: jest.fn(), create: jest.fn(), update: jest.fn() },
		executionCheckpoint: { create: jest.fn() },
		handoffRecord: {
			findFirst: jest.fn(),
			create: jest.fn(() => Promise.resolve({ id: 'handoff_1' })),
		},
		activity: { create: jest.fn() },
		projectMemory: { findUnique: jest.fn() },
	},
}));

jest.mock('../lib/proposal-store', () => ({
	__esModule: true,
	recordProposal: jest.fn(() => ({ id: 'proposal_test' })),
}));

jest.mock('../lib/job-queue', () => ({
	__esModule: true,
	cancelJob: jest.fn(() => Promise.resolve(true)),
}));

jest.mock('../lib/memory/memory-service', () => ({
	__esModule: true,
	writeTaskMemory: jest.fn(() => Promise.resolve({})),
	writeHandoffRecord: jest.fn(() => Promise.resolve({ id: 'handoff_1' })),
}));

import prisma from '../lib/prisma';

const ctx = { actorType: 'project-control' as const, now: new Date() };

describe('pause/resume/reassign tools', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('pause_task', () => {
		it('creates checkpoint and handoff', async () => {
			const task = {
				id: 'task_1',
				title: 'Test Task',
				projectId: 'proj_1',
				teamId: 'team_1',
				agentId: 'agent_1',
				status: 'in_progress',
			};
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
			});
			(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(null);
			(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'paused' });
			(prisma.agent.update as jest.Mock).mockResolvedValue({ id: 'agent_1', status: 'idle' });
			(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

			const result = await pauseTaskTool.execute({ taskId: 'task_1', summary: 'Need to pause' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any).paused).toBe(true);
			expect((result.data as any).taskId).toBe('task_1');
			expect((result.data as any).checkpointId).toBe('chk_1');
			expect((result.data as any).handoffId).toBe('handoff_1');
			expect(result.proposalId).toBeDefined();
			expect(prisma.executionCheckpoint.create).toHaveBeenCalled();
			expect(prisma.task.update).toHaveBeenCalledWith({
				where: { id: 'task_1' },
				data: { status: 'paused' },
			});
		});

		it('returns error when task not found', async () => {
			(prisma.task.findUnique as jest.Mock).mockResolvedValue(null);

			const result = await pauseTaskTool.execute({ taskId: 'task_999' }, ctx);

			expect(result.ok).toBe(false);
			expect((result.error as any).code).toBe('TASK_NOT_FOUND');
		});

		it('handles task with no active execution run', async () => {
			const task = {
				id: 'task_1',
				title: 'Test Task',
				projectId: 'proj_1',
				teamId: 'team_1',
				agentId: null,
				status: 'in_progress',
			};

			(prisma.task.findUnique as jest.Mock).mockResolvedValue(task);
			(prisma.executionRun.findFirst as jest.Mock).mockResolvedValue(null);
			(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(null);
			(prisma.task.update as jest.Mock).mockResolvedValue({ ...task, status: 'paused' });
			(prisma.activity.create as jest.Mock).mockResolvedValue({ id: 'act_1' });

			const result = await pauseTaskTool.execute({ taskId: 'task_1' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any).paused).toBe(true);
			expect((result.data as any).checkpointId).toBeUndefined();
		});
	});

	describe('propose_resume_task', () => {
		it('proposes resuming a paused task', async () => {
			(prisma.task.findUnique as jest.Mock).mockResolvedValue({
				id: 'task_1',
				title: 'Paused Task',
				projectId: 'proj_1',
				status: 'paused',
				agentId: null,
			});

			const result = await proposeResumeTaskTool.execute({ taskId: 'task_1' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any).taskId).toBe('task_1');
			expect((result.data as any).proposalId).toBeDefined();
		});

		it('returns error if task is not paused', async () => {
			(prisma.task.findUnique as jest.Mock).mockResolvedValue({
				id: 'task_1',
				title: 'Active Task',
				projectId: 'proj_1',
				status: 'in_progress',
				agentId: null,
			});

			const result = await proposeResumeTaskTool.execute({ taskId: 'task_1' }, ctx);

			expect(result.ok).toBe(false);
			expect((result.error as any).code).toBe('TASK_NOT_PAUSED');
		});
	});

	describe('propose_task_reassignment', () => {
		it('proposes reassigning a task to a new agent', async () => {
			(prisma.agent.findUnique as jest.Mock).mockResolvedValue({
				id: 'agent_2',
				name: 'New Agent',
				status: 'idle',
			});

			const result = await proposeReassignTool.execute({ taskId: 'task_1', newAgentId: 'agent_2' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any).newAgentId).toBe('agent_2');
			expect((result.data as any).proposalId).toBeDefined();
		});

		it('returns error if agent is not available', async () => {
			(prisma.agent.findUnique as jest.Mock).mockResolvedValue({
				id: 'agent_2',
				name: 'Busy Agent',
				status: 'working',
			});

			const result = await proposeReassignTool.execute({ taskId: 'task_1', newAgentId: 'agent_2' }, ctx);

			expect(result.ok).toBe(false);
			expect((result.error as any).code).toBe('AGENT_NOT_AVAILABLE');
		});
	});
});
