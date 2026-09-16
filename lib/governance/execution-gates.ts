import prisma from '../prisma';

export type ExecutionMode = 'analysis' | 'coding';

export async function getOrCreateGovernance(projectId: string) {
	return prisma.projectGovernance.upsert({
		where: { projectId },
		create: { projectId },
		update: {},
	});
}

export async function evaluateExecutionGates(projectId: string, mode: ExecutionMode) {
	const [governance, issues, runningCount] = await Promise.all([
		getOrCreateGovernance(projectId),
		prisma.projectIssue.findMany({ where: { projectId, status: 'open' }, orderBy: { createdAt: 'desc' } }),
		prisma.executionRun.count({ where: { projectId, status: { in: ['queued', 'preparing', 'running', 'checkpointed'] } } }),
	]);
	const blockers: string[] = [];
	const warnings: string[] = [];
	if (issues.some((issue) => issue.severity === 'P0')) blockers.push('Open P0 issue blocks all Project executions.');
	if (mode === 'coding' && issues.some((issue) => issue.severity === 'P1')) blockers.push('Open P1 issue blocks new coding executions.');
	for (const issue of issues.filter((issue) => ['P2', 'P3'].includes(issue.severity))) {
		warnings.push(`${issue.severity}: ${issue.title}`);
	}
	if (governance.maxConcurrentRuns !== null && runningCount >= governance.maxConcurrentRuns) {
		blockers.push('Project concurrent execution limit has been reached.');
	}
	if (governance.maxDailyTokens !== null) {
		const start = new Date();
		start.setUTCHours(0, 0, 0, 0);
		const runs = await prisma.executionRun.findMany({ where: { projectId, createdAt: { gte: start } } });
		const tokens = runs.reduce((sum, run) => sum + (run.totalTokens || 0), 0);
		if (tokens >= governance.maxDailyTokens) blockers.push('Project daily token budget has been reached.');
		else if (tokens >= governance.maxDailyTokens * 0.8) warnings.push('Project daily token budget is above 80%.');
	}
	if (governance.maxDailyCostUsd !== null) {
		const start = new Date();
		start.setUTCHours(0, 0, 0, 0);
		const runs = await prisma.executionRun.findMany({ where: { projectId, createdAt: { gte: start } } });
		const cost = runs.reduce((sum, run) => sum + (run.costUsd || 0), 0);
		if (cost >= governance.maxDailyCostUsd) blockers.push('Project daily cost budget has been reached.');
		else if (cost >= governance.maxDailyCostUsd * 0.8) warnings.push('Project daily cost budget is above 80%.');
	}
	return { allowed: blockers.length === 0, blockers, warnings, governance, issues };
}
