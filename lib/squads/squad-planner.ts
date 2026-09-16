import prisma from '../prisma';

function relevantRoles(requirement: string) {
	const text = requirement.toLowerCase();
	const roles = new Set<string>();
	if (/backend|api|payment|billing|auth|database|webhook/.test(text)) roles.add('Backend Developer');
	if (/frontend|ui|screen|react|button/.test(text)) roles.add('Frontend Developer');
	if (/test|qa|regression|quality/.test(text)) roles.add('QA Engineer');
	if (/security|permission|compliance|audit/.test(text)) roles.add('Security Reviewer');
	if (/requirement|scope|business/.test(text)) roles.add('Business Analyst');
	if (roles.size === 0) roles.add('Full-stack Developer');
	return [...roles].slice(0, 5);
}

export async function proposeSquad(projectId: string, options: { taskId?: string; requirement: string }) {
	const project = await prisma.project.findUnique({
		where: { id: projectId },
		include: { team: { include: { members: { include: { agents: { include: { tasks: true } } } } } } },
	});
	if (!project) throw new Error('Project not found');
	const neededRoles = relevantRoles(options.requirement);
	const candidates = project.team.members.flatMap((member) => member.agents.map((agent) => ({
		agentId: agent.id,
		agentName: agent.name,
		role: member.role === 'AI Agent' ? 'Full-stack Developer' : member.role,
		status: agent.status,
		activeTasks: agent.tasks.filter((task) => !['done', 'backlog'].includes(task.status)).length,
	})));
	const members = neededRoles.flatMap((role) => {
		const exact = candidates.find((agent) => agent.role === role && agent.status !== 'working');
		const fallback = candidates.find((agent) => agent.status !== 'working');
		const selected = exact || fallback;
		return selected ? [{ agentId: selected.agentId, agentName: selected.agentName, role }] : [];
	});
	const missingRoles = neededRoles.filter((role) => !members.some((member) => member.role === role));
	return {
		name: `${project.name} Squad`,
		projectId,
		taskId: options.taskId,
		reason: `Temporary squad for: ${options.requirement}`,
		members,
		missingRoles,
		warnings: missingRoles.map((role) => `No available Agent found for ${role}.`),
		requiresApproval: true,
	};
}

export async function createSquadFromProposal(proposal: Awaited<ReturnType<typeof proposeSquad>>) {
	return prisma.$transaction(async (tx) => {
		const squad = await tx.dynamicSquad.create({
			data: {
				projectId: proposal.projectId,
				taskId: proposal.taskId || null,
				name: proposal.name,
				reason: proposal.reason,
				members: {
					create: proposal.members.map((member) => ({ agentId: member.agentId, role: member.role })),
				},
			},
			include: { members: true },
		});
		const project = await tx.project.findUnique({ where: { id: proposal.projectId } });
		if (project) {
			await tx.activity.create({
				data: {
					teamId: project.teamId,
					type: 'squad_created',
					description: `${squad.name} created`,
					meta: JSON.stringify({ projectId: proposal.projectId, squadId: squad.id, members: proposal.members }),
				},
			});
		}
		return squad;
	});
}
