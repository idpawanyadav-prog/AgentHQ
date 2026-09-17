import prisma from '../../prisma';
import { findBenchAgentsTool } from './find-bench-agents';
import { consumeProposal, recordProposal } from '../../proposal-store';
import type { AgentToolDefinition, AgentToolContext, AgentToolResult } from '../types';

function buildBootstrapProposal(
	args: Record<string, unknown>,
	existingProjectId: string | null,
): { proposalId: string; data: Record<string, unknown> } {
	const projectName = String(args.projectName || '').trim();
	const description = args.description ? String(args.description) : null;
	const role = String(args.role || '').trim();
	const requiredSkills = Array.isArray(args.requiredSkills) ? args.requiredSkills.map(String) : [];
	const sprintCount = typeof args.sprintCount === 'number' ? Math.max(1, Math.min(args.sprintCount, 10)) : 3;
	const tasksPerSprint = typeof args.tasksPerSprint === 'number' ? Math.max(1, Math.min(args.tasksPerSprint, 20)) : 5;

	const tasks: Record<string, unknown>[] = [];
	for (let s = 0; s < sprintCount; s++) {
		for (let t = 0; t < tasksPerSprint; t++) {
			tasks.push({
				title: `${projectName} — Sprint ${s + 1} Task ${t + 1}`,
				description: `Task ${t + 1} for sprint ${s + 1}`,
				priority: 'medium',
				storyPoints: [1, 2, 3, 5][(s + t) % 4],
				type: t === 0 ? 'feature' : 'task',
							dependencies: '[]',
			});
		}
	}

	const proposal: Record<string, unknown> = {
		projectName,
		description,
		primaryRole: role,
		requiredSkills,
		existingProjectId: existingProjectId || null,
		sprintCount,
		tasksPerSprint,
		newTasks: tasks,
	};

	const proposalId = `proposal_project_bootstrap_${Date.now()}`;
	recordProposal({
		id: proposalId,
		toolName: 'propose_project_bootstrap',
		arguments: args,
		context: { actorType: 'project-control', now: new Date() } as any,
		result: { toolCallId: '', toolName: 'propose_project_bootstrap', ok: true, data: proposal },
		createdAt: new Date(),
		ttlMs: 24 * 60 * 60 * 1000,
	});

	return { proposalId, data: proposal };
}

export const proposeProjectBootstrapTool: AgentToolDefinition = {
	name: 'propose_project_bootstrap',
	description: 'Propose a complete project bootstrap: team, role groups, sprints, tasks, and initial staffing plan.',
	inputSchema: {
		type: 'object',
		properties: {
			projectName: { type: 'string' },
			description: { type: 'string' },
			role: { type: 'string' },
			requiredSkills: { type: 'array', items: { type: 'string' } },
			sprintCount: { type: 'integer' },
			tasksPerSprint: { type: 'integer' },
		},
		required: ['projectName', 'role'],
	},
	risk: 'high',
	approvalMode: 'proposal',
	allowedActors: ['project-control'],
	async execute(args) {
		const projectName = String(args.projectName).trim();
		if (!projectName) {
			return { ok: false, error: { code: 'INVALID_INPUT', message: 'projectName is required' } };
		}

		const existingProject = await prisma.project.findFirst({
			orderBy: { createdAt: 'desc' },
		});

		const role = String(args.role || '').trim();
		const requiredSkills = Array.isArray(args.requiredSkills) ? args.requiredSkills.map(String) : [];
		const benchResult = await findBenchAgentsTool.execute({ role, requiredSkills, count: 5 }, {});
		const benchMatches = benchResult.data && typeof benchResult.data === 'object' && 'matches' in benchResult.data
			? (benchResult.data as { matches: unknown[] }).matches
			: [];

		const proposal = buildBootstrapProposal(args, existingProject?.id || null);

		return {
			ok: true,
			data: {
				...proposal.data,
				proposalId: proposal.proposalId,
				existingProjectId: existingProject?.id || null,
				benchMatches,
				message: existingProject
					? `Existing project "${existingProject.name}" found (id: ${existingProject.id}). The bootstrap will add sprints and tasks.`
					: 'No existing project found. The bootstrap will create a new project with team, sprints, and tasks.',
			},
		};
	},
};

export async function applyProjectBootstrap(proposalId: string, teamId?: string): Promise<AgentToolResult> {
	const proposal = consumeProposal(proposalId);
	if (!proposal) {
		return { ok: false, error: { code: 'PROPOSAL_NOT_FOUND', message: `Proposal ${proposalId} not found or expired.` } };
	}

	const data = proposal.result.data as Record<string, unknown>;
	const projectName = String(data.projectName || '').trim();
	const description = data.description as string | null;
	const role = String(data.primaryRole || '').trim();
	const requiredSkills = data.requiredSkills as string[];
	const sprintCount = (data.sprintCount as number) || 3;
	const tasksPerSprint = (data.tasksPerSprint as number) || 5;
	const existingProjectId = data.existingProjectId as string | null;

	try {
		if (existingProjectId) {
			const project = await prisma.project.findUnique({ where: { id: existingProjectId } });
			if (!project) {
				return { ok: false, error: { code: 'PROJECT_NOT_FOUND', message: `Project ${existingProjectId} no longer exists.` } };
			}
			const newSprints = await prisma.$transaction(async (tx) => {
				const sprints = [];
				for (let s = 0; s < sprintCount; s++) {
					sprints.push(await tx.sprint.create({
						data: {
							name: `Sprint ${s + 1}`,
							goal: `${projectName} sprint ${s + 1}`,
							projectId: existingProjectId,
							order: s,
							status: 'planned',
						},
					}));
				}
				return sprints;
			});

			for (const sprint of newSprints) {
				for (let t = 0; t < tasksPerSprint; t++) {
					await prisma.task.create({
						data: {
							title: `${projectName} — Sprint ${sprint.order + 1} Task ${t + 1}`,
							description: `Task ${t + 1} for sprint ${sprint.order + 1}`,
							projectId: existingProjectId,
							teamId: project.teamId,
							sprintId: sprint.id,
							priority: 'medium',
							storyPoints: [1, 2, 3, 5][t % 4],
							status: 'backlog',
							type: t === 0 ? 'feature' : 'task',
							dependencies: '[]',
						},
					});
				}
			}

			return { ok: true, data: { message: `Added ${sprintCount} sprints with ${tasksPerSprint} tasks each to project ${projectName}.`, projectId: existingProjectId, sprintsCreated: sprintCount, tasksCreated: sprintCount * tasksPerSprint } };
		}

		const team = teamId
			? await prisma.team.findUnique({ where: { id: teamId } })
			: await prisma.team.create({
					data: {
						name: `${projectName} Team`,
						description: description || `Team for ${projectName}`,
						status: 'active',
					},
			  });

		const rg = await prisma.roleGroup.create({
			data: {
				name: role,
				description: `Primary role group for ${projectName}`,
				toolPolicy: '{}',
			},
		});

		const newProject = await prisma.project.create({
			data: {
				name: projectName,
				description,
				status: 'active',
				teamId: team.id,
				progress: 0,
			},
		});

		const sprints = await prisma.$transaction(async (tx) => {
			const result = [];
			for (let s = 0; s < sprintCount; s++) {
				result.push(await tx.sprint.create({
					data: {
						name: `Sprint ${s + 1}`,
						goal: `${projectName} sprint ${s + 1}`,
						projectId: newProject.id,
						order: s,
						status: s === 0 ? 'active' : 'planned',
					},
				}));
			}
			return result;
		});

		for (const sprint of sprints) {
			for (let t = 0; t < tasksPerSprint; t++) {
				await prisma.task.create({
					data: {
						title: `${projectName} — Sprint ${sprint.order + 1} Task ${t + 1}`,
						description: `Task ${t + 1} for sprint ${sprint.order + 1}`,
						projectId: newProject.id,
						teamId: team.id,
						sprintId: sprint.id,
						priority: 'medium',
						storyPoints: [1, 2, 3, 5][t % 4],
						status: 'backlog',
						type: t === 0 ? 'feature' : 'task',
							dependencies: '[]',
					},
				});
			}
		}

		return { ok: true, data: { message: `Project "${projectName}" created with ${sprintCount} sprints and ${sprintCount * tasksPerSprint} tasks.`, projectId: newProject.id, teamId: team.id, roleGroupId: rg.id, sprintsCreated: sprintCount, tasksCreated: sprintCount * tasksPerSprint } };
	} catch (err) {
		return { ok: false, error: { code: 'APPLY_ERROR', message: err instanceof Error ? err.message : 'Failed to apply project bootstrap' } };
	}
}
