import prisma from '../../prisma';
import { recordProposal, consumeProposal } from '../../proposal-store';
import { findBenchAgentsTool } from './find-bench-agents';
import type { AgentToolDefinition, AgentToolResult } from '../types';

const ACTIVE_STATUSES = ['idle', 'working', 'error'];

export const proposeCapacityChangeTool: AgentToolDefinition = {
	name: 'propose_capacity_change',
	description: 'Propose a capacity change for a team: hire new agents (from bench or new), or remove existing agents.',
	inputSchema: {
		type: 'object',
		properties: {
			projectId: { type: 'string' },
			change: { type: 'string', enum: ['hire', 'remove'] },
			role: { type: 'string' },
			requiredSkills: { type: 'array', items: { type: 'string' } },
			agentId: { type: 'string' },
			reason: { type: 'string' },
			maxSlots: { type: 'integer' },
		},
		required: ['projectId', 'change'],
	},
	risk: 'medium',
	approvalMode: 'proposal',
	allowedActors: ['project-control'],
	async execute(args) {
		const projectId = String(args.projectId);
		const change = String(args.change) as 'hire' | 'remove';
		const project = await prisma.project.findUnique({ where: { id: projectId }, include: { team: { include: { members: { include: { agents: true } } } } } });
		if (!project) {
			return { ok: false, error: { code: 'PROJECT_NOT_FOUND', message: `Project ${projectId} not found.` } };
		}

		if (change === 'remove') {
			const agentId = args.agentId ? String(args.agentId) : '';
			if (!agentId) {
				return { ok: false, error: { code: 'INVALID_INPUT', message: 'agentId is required for removal.' } };
			}
			const member = project.team.members.find((m) => m.agents.some((a) => a.id === agentId));
			if (!member) {
				return { ok: false, error: { code: 'AGENT_NOT_IN_TEAM', message: `Agent ${agentId} is not in the project's team.` } };
			}
			const agent = member.agents.find((a) => a.id === agentId);
			const proposalId = `proposal_capacity_${Date.now()}`;
			const data = {
				type: 'capacity_change',
				change: 'remove',
				projectId,
				teamId: project.teamId,
				agentId,
				memberId: member.id,
				agentName: agent?.name || 'unknown',
				role: member.role,
				reason: args.reason ? String(args.reason) : 'Capacity reduction requested.',
			};
			recordProposal({
				id: proposalId, toolName: 'propose_capacity_change', arguments: args,
				context: { actorType: 'project-control' },
				result: { toolCallId: '', toolName: 'propose_capacity_change', ok: true, data },
				createdAt: new Date(), ttlMs: 24 * 60 * 60 * 1000,
			});
			return { ok: true, data: { ...data, proposalId }, message: `Removal of agent ${data.agentName} proposed.` };
		}

		const role = args.role ? String(args.role) : 'Full Stack';
		const requiredSkills = Array.isArray(args.requiredSkills) ? args.requiredSkills.map(String) : [];
		const slots = typeof args.maxSlots === 'number' ? Math.max(1, Math.min(args.maxSlots, 5)) : 1;

		const benchResult = (await findBenchAgentsTool.execute({ role, requiredSkills, count: slots }, { actorType: 'project-control', now: new Date() })) as AgentToolResult;
		const benchMatches = benchResult.data && typeof benchResult.data === 'object' && 'matches' in benchResult.data
			? (benchResult.data as { matches: unknown[] }).matches
			: [];

		const proposalId = `proposal_capacity_${Date.now()}`;
		const data = {
			type: 'capacity_change',
			change: 'hire',
			projectId,
			teamId: project.teamId,
			role,
			requiredSkills,
			slots,
			benchMatches,
			reason: args.reason ? String(args.reason) : `Hire ${slots} ${role} agent(s).`,
		};
		recordProposal({
			id: proposalId, toolName: 'propose_capacity_change', arguments: args, context: { actorType: 'project-control', now: new Date() } as any,
			result: { toolCallId: '', toolName: 'propose_capacity_change', ok: true, data }, ttlMs: 24 * 60 * 60 * 1000,
		});
		return { ok: true, data: { ...data, proposalId }, message: `Hire proposal: ${slots} ${role} slot(s) — ${benchMatches.length} bench candidates available.` };
	},
};

export async function applyCapacityChange(proposalId: string): Promise<AgentToolResult> {
	const proposal = consumeProposal(proposalId);
	if (!proposal) {
		return { ok: false, error: { code: 'PROPOSAL_NOT_FOUND', message: `Proposal ${proposalId} not found or expired.` } };
	}
	const d = proposal.result.data as Record<string, unknown>;
	try {
		if (d.change === 'remove') {
			const memberId = String(d.memberId);
			const agentId = String(d.agentId);
			await prisma.$transaction([
				prisma.member.update({ where: { id: memberId }, data: { teamId: 'on-bench' } }),
				prisma.activity.create({
					data: {
						type: 'agent_removed',
						description: `Removed agent "${d.agentName}" from project ${d.projectId}`,
						meta: JSON.stringify({ agentId, projectId: String(d.projectId), reason: d.reason }),
						teamId: String(d.teamId),
					},
				}),
			]);
			return { ok: true, data: { message: `Agent "${d.agentName}" removed and returned to bench.`, agentId }, message: `Removed ${d.agentName}` };
		}

		const benchMatches = d.benchMatches as Array<{ agentId: string }>;
		if (!benchMatches.length) {
			const role = d.role as string;
			const teamId = String(d.teamId);
			const member = await prisma.member.create({ data: { name: `${role} (new hire)`, role, type: 'ai', teamId } });
			const agent = await prisma.agent.create({
				data: { name: `${role} (new hire)`, type: 'anthropic', model: 'claude-sonnet-4-5', memberId: member.id, config: '{}', status: 'idle' },
			});
			return { ok: true, data: { message: 'No bench matches. Created new hire.', agentId: agent.id, memberId: member.id, newHire: true } };
		}

		const slots = (d.slots as number) || 1;
		const assigned: string[] = [];
		for (let i = 0; i < Math.min(slots, benchMatches.length); i++) {
			const match = benchMatches[i];
			const agent = await prisma.agent.findUnique({ where: { id: match.agentId } });
			if (agent) {
				await prisma.member.update({ where: { id: agent.memberId }, data: { teamId: String(d.teamId) } });
				assigned.push(match.agentId);
			}
		}
		return { ok: true, data: { message: `Assigned ${assigned.length} bench agent(s) to project team.`, assigned, totalMatches: benchMatches.length }, message: `Assigned ${assigned.length} agents` };
	} catch (err) {
		return { ok: false, error: { code: 'APPLY_ERROR', message: err instanceof Error ? err.message : 'Failed to apply capacity change' } };
	}
}
