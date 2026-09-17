jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		project: { findMany: jest.fn() },
		team: { findUnique: jest.fn() },
		roleGroup: { findMany: jest.fn() },
	},
}));

jest.mock('../lib/configured-models', () => ({
	readConfiguredModels: jest.fn(() => [
		{ id: 'm1', name: 'Claude', provider: 'anthropic', modelId: 'claude-sonnet-4' },
	]),
}));

import { getOrganizationStatusTool } from '../lib/agent-tools/tools/get-organization-status';
import prisma from '../lib/prisma';

describe('get_organization_status tool', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns projects, bench, roleGroups, and configuredModels', async () => {
		prisma.project.findMany.mockResolvedValue([
			{ id: 'p1', name: 'Test', status: 'active', progress: 50, teamId: 't1', updatedAt: new Date() },
		]);
		prisma.team.findUnique.mockResolvedValue({
			id: 'on-bench',
			members: [],
		});
		prisma.roleGroup.findMany.mockResolvedValue([
			{ id: 'rg1', name: 'Dev', description: null, color: null },
		]);

		const result = await getOrganizationStatusTool.execute(
			{ includeBench: true, includeProjects: true },
			{ actorType: 'project-control', now: new Date() },
		);

		expect(result.ok).toBe(true);
		expect((result.data as Record<string, unknown>).projects).toHaveLength(1);
		expect((result.data as Record<string, unknown>).bench).toBeDefined();
		expect((result.data as Record<string, unknown>).roleGroups).toHaveLength(1);
		expect((result.data as Record<string, unknown>).configuredModels).toHaveLength(1);
	});

	it('returns bench count and agents', async () => {
		prisma.project.findMany.mockResolvedValue([]);
		prisma.team.findUnique.mockResolvedValue({
			id: 'on-bench',
			members: [
				{
					id: 'm1',
					role: 'Backend Developer',
					agents: [
						{ id: 'a1', name: 'Tim', status: 'idle', model: 'claude', tasks: [] },
					],
				},
			],
		});
		prisma.roleGroup.findMany.mockResolvedValue([]);

		const result = await getOrganizationStatusTool.execute(
			{},
			{ actorType: 'project-control', now: new Date() },
		);

		expect(result.ok).toBe(true);
		const bench = (result.data as Record<string, unknown>).bench as Record<string, unknown>;
		expect(bench.agentCount).toBe(1);
		expect((bench.agents as unknown[])).toHaveLength(1);
		expect((bench.agents as unknown[])[0]?.name).toBe('Tim');
	});

	it('handles missing bench team gracefully', async () => {
		prisma.project.findMany.mockResolvedValue([]);
		prisma.team.findUnique.mockResolvedValue(null);
		prisma.roleGroup.findMany.mockResolvedValue([]);

		const result = await getOrganizationStatusTool.execute(
			{},
			{ actorType: 'project-control', now: new Date() },
		);

		expect(result.ok).toBe(true);
		const bench = (result.data as Record<string, unknown>).bench as Record<string, unknown>;
		expect(bench.agentCount).toBe(0);
	});
});
