jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		projectMemory: { findUnique: jest.fn() },
		taskMemory: { findUnique: jest.fn() },
		decisionRecord: { findMany: jest.fn() },
		executionCheckpoint: { findFirst: jest.fn() },
		handoffRecord: { findFirst: jest.fn() },
		executionRun: { findMany: jest.fn(), findUnique: jest.fn() },
		agentMemory: { findMany: jest.fn() },
	},
}));

jest.mock('../lib/proposal-store', () => ({
	recordProposal: jest.fn((record) => ({ ...record, id: record.id || 'proposal_test' })),
}));

jest.mock('../lib/job-queue', () => ({
	cancelJob: jest.fn(() => Promise.resolve(true)),
}));

import prisma from '../lib/prisma';
import { getProjectMemoryTool } from '../lib/agent-tools/tools/get-project-memory';
import { getTaskMemoryTool } from '../lib/agent-tools/tools/get-task-memory';
import { getDecisionsTool } from '../lib/agent-tools/tools/get-decisions';
import { getCheckpointTool } from '../lib/agent-tools/tools/get-checkpoint';
import { getHandoffTool } from '../lib/agent-tools/tools/get-handoff';

const ctx = { actorType: 'project-control' as const, now: new Date() };

describe('memory tools', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	describe('get_project_memory', () => {
		it('returns data when project memory exists', async () => {
			const memory = {
				projectId: 'proj_1',
				mission: 'Build it',
				productSummary: 'Product',
				architecture: 'monolith',
				techStack: 'Node.js',
				currentPhase: 'building',
				currentGoal: 'Ship v1',
				completedWork: 'Setup',
				keyDecisions: 'Use Postgres',
				knownRisks: 'Timeline',
				blockers: 'None',
				nextActions: 'Write code',
				openQuestions: 'Auth?',
				testStrategy: 'E2E',
				releaseNotes: null,
				version: 2,
			};

			(prisma.projectMemory.findUnique as jest.Mock).mockResolvedValue(memory);

			const result = await getProjectMemoryTool.execute({ projectId: 'proj_1' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any).mission).toBe('Build it');
			expect((result.data as any).currentPhase).toBe('building');
		});

		it('returns NO_MEMORY error when no memory exists', async () => {
			(prisma.projectMemory.findUnique as jest.Mock).mockResolvedValue(null);

			const result = await getProjectMemoryTool.execute({ projectId: 'proj_none' }, ctx);

			expect(result.ok).toBe(false);
			expect((result.error as any).code).toBe('NO_MEMORY');
			expect((result.error as any).message).toContain('No project memory found');
		});
	});

	describe('get_task_memory', () => {
		it('returns data when task memory exists', async () => {
			const memory = {
				taskId: 'task_1',
				projectId: 'proj_1',
				objective: 'Implement auth',
				context: 'JWT-based',
				investigation: 'Researched libraries',
				implementation: 'In progress',
				filesTouched: 'src/auth.ts',
				decisions: 'Use bcrypt',
				blockers: 'None',
				remainingWork: 'Tests',
				nextAction: 'Write unit tests',
				lastAgentId: 'agent_1',
				version: 2,
			};

			(prisma.taskMemory.findUnique as jest.Mock).mockResolvedValue(memory);

			const result = await getTaskMemoryTool.execute({ taskId: 'task_1' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any).objective).toBe('Implement auth');
			expect((result.data as any).lastAgentId).toBe('agent_1');
		});

		it('returns NO_MEMORY error when task memory does not exist', async () => {
			(prisma.taskMemory.findUnique as jest.Mock).mockResolvedValue(null);

			const result = await getTaskMemoryTool.execute({ taskId: 'task_none' }, ctx);

			expect(result.ok).toBe(false);
			expect((result.error as any).code).toBe('NO_MEMORY');
		});
	});

	describe('get_relevant_decisions', () => {
		it('returns active decisions filtered by projectId', async () => {
			const decisions = [
				{ id: 'd1', projectId: 'proj_1', taskId: null, title: 'Use Prisma', decision: 'Use Prisma ORM', status: 'active', createdAt: new Date() },
				{ id: 'd2', projectId: 'proj_1', taskId: null, title: 'Use Next.js', decision: 'Use Next.js', status: 'active', createdAt: new Date() },
			];

			(prisma.decisionRecord.findMany as jest.Mock).mockResolvedValue(decisions);

			const result = await getDecisionsTool.execute({ projectId: 'proj_1' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any[])).toHaveLength(2);
			expect(prisma.decisionRecord.findMany).toHaveBeenCalledWith({
				where: { projectId: 'proj_1', status: 'active' },
				orderBy: { createdAt: 'desc' },
			});
		});

		it('filters by taskId when provided', async () => {
			const decisions = [
				{ id: 'd1', projectId: 'proj_1', taskId: 'task_1', title: 'Task decision', decision: 'Use Mongo', status: 'active', createdAt: new Date() },
			];

			(prisma.decisionRecord.findMany as jest.Mock).mockResolvedValue(decisions);

			const result = await getDecisionsTool.execute({ projectId: 'proj_1', taskId: 'task_1' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any[])).toHaveLength(1);
			expect((result.data as any[])[0].taskId).toBe('task_1');
			expect(prisma.decisionRecord.findMany).toHaveBeenCalledWith({
				where: { projectId: 'proj_1', status: 'active', taskId: 'task_1' },
				orderBy: { createdAt: 'desc' },
			});
		});
	});

	describe('get_latest_checkpoint', () => {
		it('returns latest checkpoint for executionRunId', async () => {
			const checkpoint = {
				id: 'chk_1',
				executionRunId: 'run_1',
				phase: 'paused',
				taskStatus: 'paused',
				agentStatus: 'idle',
				metadata: '{"reason":"pause"}',
				createdAt: new Date(),
			};

			(prisma.executionCheckpoint.findFirst as jest.Mock).mockResolvedValue(checkpoint);

			const result = await getCheckpointTool.execute({ executionRunId: 'run_1' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any).id).toBe('chk_1');
			expect((result.data as any).phase).toBe('paused');
			expect(prisma.executionCheckpoint.findFirst).toHaveBeenCalledWith({
				where: { executionRunId: 'run_1' },
				orderBy: { createdAt: 'desc' },
			});
		});

		it('returns NO_CHECKPOINT error when no checkpoint exists', async () => {
			(prisma.executionCheckpoint.findFirst as jest.Mock).mockResolvedValue(null);

			const result = await getCheckpointTool.execute({ executionRunId: 'run_none' }, ctx);

			expect(result.ok).toBe(false);
			expect((result.error as any).code).toBe('NO_CHECKPOINT');
		});
	});

	describe('get_task_handoff', () => {
		it('returns latest handoff for project', async () => {
			const handoff = {
				id: 'ho_1',
				projectId: 'proj_1',
				taskId: null,
				fromAgentId: 'agent_1',
				toAgentId: 'agent_2',
				type: 'task_resume',
				summary: 'Resumed task',
				completedWork: 'Partial work done',
				remainingWork: 'Finish tests',
				nextActions: 'Run tests',
				blockers: 'None',
				importantFiles: 'src/',
				decisions: null,
				createdAt: new Date(),
				consumedAt: null,
			};

			(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(handoff);

			const result = await getHandoffTool.execute({ projectId: 'proj_1' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any).id).toBe('ho_1');
			expect((result.data as any).type).toBe('task_resume');
			expect((result.data as any).fromAgentId).toBe('agent_1');
			expect(prisma.handoffRecord.findFirst).toHaveBeenCalledWith({
				where: { projectId: 'proj_1' },
				orderBy: { createdAt: 'desc' },
			});
		});

		it('filters by taskId when provided', async () => {
			const handoff = {
				id: 'ho_2',
				projectId: 'proj_1',
				taskId: 'task_1',
				fromAgentId: 'agent_1',
				toAgentId: 'agent_2',
				type: 'task_pause',
				summary: 'Paused task',
				completedWork: null,
				remainingWork: 'Paused',
				nextActions: 'Resume needed',
				blockers: 'None',
				importantFiles: null,
				decisions: null,
				createdAt: new Date(),
				consumedAt: null,
			};

			(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(handoff);

			const result = await getHandoffTool.execute({ projectId: 'proj_1', taskId: 'task_1' }, ctx);

			expect(result.ok).toBe(true);
			expect((result.data as any).taskId).toBe('task_1');
			expect((result.data as any).type).toBe('task_pause');
			expect(prisma.handoffRecord.findFirst).toHaveBeenCalledWith({
				where: { projectId: 'proj_1', taskId: 'task_1' },
				orderBy: { createdAt: 'desc' },
			});
		});

		it('returns NO_HANDOFF error when no handoff exists', async () => {
			(prisma.handoffRecord.findFirst as jest.Mock).mockResolvedValue(null);

			const result = await getHandoffTool.execute({ projectId: 'proj_none' }, ctx);

			expect(result.ok).toBe(false);
			expect((result.error as any).code).toBe('NO_HANDOFF');
		});
	});
});
