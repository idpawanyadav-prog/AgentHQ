import prisma from './prisma';
import { parseJsonConfig } from './configured-models';

const MAX_INSTRUCTION_CHARS = 4000;
const MAX_TOTAL_INSTRUCTION_CHARS = 7500;
const MAX_SKILLS = 50;
export const MAX_SYSTEM_PROMPT_CHARS = 12000;

function truncate(value: string, max: number) {
	if (max <= 0) return '';
	return value.length <= max ? value : value.slice(0, max);
}

function remainingBudget(parts: string[]) {
	const used = parts.filter(Boolean).join('\n\n').length;
	return Math.max(0, MAX_SYSTEM_PROMPT_CHARS - used - (parts.length > 0 ? 2 : 0));
}

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
	});

	const sections = [
		truncate(fallbackPrompt || `You are ${agent.name}, an agent in the ${agent.member.role} role. Be concise, practical, and task-focused.`, 1000),
	];

	if (assignment?.roleGroup) {
		const roleGroup = assignment.roleGroup;
		sections.push(truncate(`Role:\n${roleGroup.name}`, 300));

		let remainingInstructionChars = MAX_TOTAL_INSTRUCTION_CHARS;
		const instructions = roleGroup.instructions
			.map((instruction) => {
				if (remainingInstructionChars <= 0) return '';
				const content = instruction.content.slice(0, Math.min(MAX_INSTRUCTION_CHARS, remainingInstructionChars));
				remainingInstructionChars -= content.length;
				return `- ${instruction.title || instruction.filename}:\n${content}`;
			})
			.filter(Boolean);
		if (instructions.length > 0) {
			const roleInstructions = `Role instructions:\n${instructions.join('\n\n')}`;
			sections.push(truncate(roleInstructions, Math.min(roleInstructions.length, remainingBudget(sections))));
		}
	}

	if (agentPrompt) {
		const agentSection = `Agent-specific instructions:\n${agentPrompt}`;
		sections.push(truncate(agentSection, Math.min(1700, remainingBudget(sections))));
	}

	if (assignment?.roleGroup) {
		const roleGroup = assignment.roleGroup;
		const skills = roleGroup.skills.slice(0, MAX_SKILLS).map((skill) =>
			`- ${skill.name}: ${skill.level}${skill.description ? ` (${skill.description})` : ''}`
		);
		if (skills.length > 0) {
			const skillSection = `Skills:\n${skills.join('\n')}`;
			sections.push(truncate(skillSection, Math.min(1500, remainingBudget(sections))));
		}
	}

	return truncate(sections.filter(Boolean).join('\n\n'), MAX_SYSTEM_PROMPT_CHARS);
}
