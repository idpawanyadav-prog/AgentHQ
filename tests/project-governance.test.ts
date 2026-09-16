jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		projectGovernance: { upsert: jest.fn() },
		projectIssue: { findMany: jest.fn() },
		executionRun: { count: jest.fn(), findMany: jest.fn() },
	},
}));

const prisma = jest.requireMock('../lib/prisma').default;

import { evaluateExecutionGates } from '../lib/governance/execution-gates';

beforeEach(() => {
	jest.clearAllMocks();
	prisma.projectGovernance.upsert.mockResolvedValue({ projectId: 'project-1', maxConcurrentRuns: null, maxDailyTokens: null, maxDailyCostUsd: null });
	prisma.projectIssue.findMany.mockResolvedValue([]);
	prisma.executionRun.count.mockResolvedValue(0);
	prisma.executionRun.findMany.mockResolvedValue([]);
});

it('blocks all execution for P0 issues', async () => {
	prisma.projectIssue.findMany.mockResolvedValue([{ severity: 'P0', title: 'Prod down', status: 'open' }]);
	const gates = await evaluateExecutionGates('project-1', 'analysis');
	expect(gates.allowed).toBe(false);
	expect(gates.blockers[0]).toContain('P0');
});

it('blocks coding but allows analysis for P1 issues', async () => {
	prisma.projectIssue.findMany.mockResolvedValue([{ severity: 'P1', title: 'Auth broken', status: 'open' }]);
	await expect(evaluateExecutionGates('project-1', 'analysis')).resolves.toMatchObject({ allowed: true });
	await expect(evaluateExecutionGates('project-1', 'coding')).resolves.toMatchObject({ allowed: false });
});

it('warns for P2/P3 issues and budget threshold', async () => {
	prisma.projectGovernance.upsert.mockResolvedValue({ projectId: 'project-1', maxConcurrentRuns: null, maxDailyTokens: 100, maxDailyCostUsd: null });
	prisma.projectIssue.findMany.mockResolvedValue([{ severity: 'P2', title: 'Slow tests', status: 'open' }]);
	prisma.executionRun.findMany.mockResolvedValue([{ totalTokens: 85 }]);
	const gates = await evaluateExecutionGates('project-1', 'coding');
	expect(gates.allowed).toBe(true);
	expect(gates.warnings.join('\n')).toContain('P2');
	expect(gates.warnings.join('\n')).toContain('80%');
});
