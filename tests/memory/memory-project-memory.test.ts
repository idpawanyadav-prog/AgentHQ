jest.mock('../../lib/prisma', () => ({
	__esModule: true,
	default: {
		projectMemory: {
			findUnique: jest.fn(),
			create: jest.fn(),
			update: jest.fn(),
		},
		decisionRecord: {
			findMany: jest.fn(),
			create: jest.fn(),
		},
		$transaction: jest.fn(),
	},
}));

const mockPrisma = jest.requireMock('../../lib/prisma').default;

import * as projectMemorySvc from '../../lib/memory/project-memory';

describe('Project Memory Service', () => {
	beforeEach(() => {
		jest.clearAllMocks();
		mockPrisma.projectMemory.findUnique.mockReset();
		mockPrisma.projectMemory.create.mockReset();
		mockPrisma.projectMemory.update.mockReset();
		mockPrisma.decisionRecord.findMany.mockReset();
		mockPrisma.decisionRecord.create.mockReset();
	});

	it('creates a new project memory when none exists', async () => {
		mockPrisma.projectMemory.findUnique.mockResolvedValue(null);
		mockPrisma.projectMemory.create.mockResolvedValue({
			projectId: 'proj1',
			mission: 'Mission A',
			currentPhase: 'planning',
			version: 1,
		});

		const result = await projectMemorySvc.upsertProjectMemory(mockPrisma, 'proj1', {
			mission: 'Mission A',
			currentPhase: 'planning',
		});

		expect(mockPrisma.projectMemory.create).toHaveBeenCalledTimes(1);
		expect(result.projectId).toBe('proj1');
	});

	it('updates existing project memory', async () => {
		const existing = {
			id: 'mem1',
			projectId: 'proj1',
			mission: 'Old Mission',
			currentPhase: 'building',
			version: 1,
		};
		mockPrisma.projectMemory.findUnique.mockResolvedValue(existing);
		mockPrisma.projectMemory.update.mockResolvedValue({
			...existing,
			mission: 'New Mission',
		});

		const result = await projectMemorySvc.upsertProjectMemory(mockPrisma, 'proj1', {
			mission: 'New Mission',
		});

		expect(mockPrisma.projectMemory.update).toHaveBeenCalledTimes(1);
		expect(result.mission).toBe('New Mission');
	});

	it('appends completed work', async () => {
		const existing = {
			id: 'mem1',
			projectId: 'proj1',
			completedWork: '- Task 1 done',
		};
		mockPrisma.projectMemory.findUnique.mockResolvedValue(existing);
		mockPrisma.projectMemory.update.mockResolvedValue({
			...existing,
			completedWork: '- Task 1 done\n- Task 2 done',
		});

		await projectMemorySvc.appendCompletedWork(mockPrisma, 'proj1', 'Task 2 done');

		expect(mockPrisma.projectMemory.update).toHaveBeenCalledTimes(1);
	});

	it('creates completed work from scratch if no memory exists', async () => {
		mockPrisma.projectMemory.findUnique.mockResolvedValue(null);
		mockPrisma.projectMemory.create.mockResolvedValue({
			projectId: 'proj1',
			completedWork: '- First task',
		});

		await projectMemorySvc.appendCompletedWork(mockPrisma, 'proj1', 'First task');

		expect(mockPrisma.projectMemory.create).toHaveBeenCalledTimes(1);
	});

	it('adds a decision and updates keyDecisions', async () => {
		const existing = {
			id: 'mem1',
			projectId: 'proj1',
			keyDecisions: '[Existing] prior decision',
		};
		mockPrisma.decisionRecord.create.mockResolvedValue({
			id: 'dec1',
			projectId: 'proj1',
			title: 'Use PostgreSQL',
			decision: 'Use PostgreSQL',
		});
		mockPrisma.projectMemory.findUnique.mockResolvedValue(existing);
		mockPrisma.projectMemory.update.mockResolvedValue({
			...existing,
			keyDecisions: '[Existing] prior decision\n- [Use PostgreSQL] Use PostgreSQL',
		});

		await projectMemorySvc.addDecision(mockPrisma, 'proj1', 'Use PostgreSQL', 'Use PostgreSQL');

		expect(mockPrisma.decisionRecord.create).toHaveBeenCalledTimes(1);
		expect(mockPrisma.projectMemory.update).toHaveBeenCalledTimes(1);
	});

	it('returns full project context', async () => {
		const memory = {
			id: 'mem1',
			projectId: 'proj1',
			mission: 'Build app',
			currentPhase: 'building',
		};
		mockPrisma.projectMemory.findUnique.mockResolvedValue(memory);
		mockPrisma.decisionRecord.findMany.mockResolvedValue([
			{ id: 'dec1', title: 'Use React', decision: 'Use React', status: 'active' },
		]);

		const ctx = await projectMemorySvc.getProjectContext(mockPrisma, 'proj1');

		expect(ctx?.memory.mission).toBe('Build app');
		expect(ctx?.activeDecisions).toHaveLength(1);
	});

	it('returns null when no memory exists for context', async () => {
		mockPrisma.projectMemory.findUnique.mockResolvedValue(null);

		const ctx = await projectMemorySvc.getProjectContext(mockPrisma, 'proj1');

		expect(ctx).toBeNull();
	});
});
