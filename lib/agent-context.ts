import prisma from './prisma';
import { parseJsonConfig } from './configured-models';

const MAX_INSTRUCTION_CHARS = 4000;
const MAX_TOTAL_INSTRUCTION_CHARS = 12000;
const MAX_SKILLS = 50;

export async function buildAgentSystemPrompt(agentId: string, fallbackPrompt: string) {
	const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { member: true } });
	if (!agent) throw new Error('Agent not found');

	const config = parseJsonConfig(agent.config);
	const agentPrompt = typeof config.systemPrompt === 'string' ? config.systemPrompt.trim() : '';
	const assignment = await prisma.agentRoleAssignment.findFirst({
		where: { agentId },
		include: {
			roleGroup: {
				include: {
					instructions: { orderBy: { createdAt: 'asc' } },
					skills: { orderBy: { createdAt: 'asc' } },
				},
			},
		},
		orderBy: { updatedAt: 'desc' },
	});

	const sections = [
		fallbackPrompt || `You are ${agent.name}, an agent in the ${agent.member.role} role. Be concise, practical, and task-focused.`,
	];

	if (assignment?.roleGroup) {
		const roleGroup = assignment.roleGroup;
		sections.push(`Role:\n${roleGroup.name}`);

		let remainingInstructionChars = MAX_TOTAL_INSTRUCTION_CHARS;
		const instructions = roleGroup.instructions
			.map((instruction) => {
				if (remainingInstructionChars <= 0) return '';
				const content = instruction.content.slice(0, Math.min(MAX_INSTRUCTION_CHARS, remainingInstructionChars));
				remainingInstructionChars -= content.length;
				return `- ${instruction.title || instruction.filename}:\n${content}`;
			})
			.filter(Boolean);
		if (instructions.length > 0) sections.push(`Role instructions:\n${instructions.join('\n\n')}`);

		const skills = roleGroup.skills.slice(0, MAX_SKILLS).map((skill) =>
			`- ${skill.name}: ${skill.level}${skill.description ? ` (${skill.description})` : ''}`
		);
		if (skills.length > 0) sections.push(`Skills:\n${skills.join('\n')}`);
	}

	if (agentPrompt) sections.push(`Agent-specific instructions:\n${agentPrompt}`);

	return sections.join('\n\n');
}
