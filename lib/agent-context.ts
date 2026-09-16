import prisma from './prisma';
import { parseJsonConfig } from './configured-models';

const MAX_INSTRUCTION_CHARS = 4000;
const MAX_TOTAL_INSTRUCTION_CHARS = 5000;
const MAX_SKILLS = 50;
const MAX_TEAM_MEMBERS_IN_PROMPT = 50;
const MAX_TASKS_IN_PROMPT = 20;
export const MAX_SYSTEM_PROMPT_CHARS = 12000;

const ACTIVE_TASK_STATUSES = new Set(['ready', 'in_progress', 'review', 'testing', 'blocked']);

export type AgentHQContext = {
	agent: {
		name: string;
		role: string;
		type: 'ai';
		status: string;
		provider: string;
		model: string;
	};
	team: {
		name: string;
		description: string | null;
		status: string;
	} | null;
	teammates: Array<{
		name: string;
		role: string;
		type: 'human' | 'ai';
		status?: string;
	}>;
	teammateCount: number;
	project: {
		name: string;
		description: string | null;
		status: string;
		progress: number;
		repoUrl: string | null;
	} | null;
	sprint: {
		name: string;
		goal: string | null;
		status: string;
		startDate: Date | null;
		endDate: Date | null;
	} | null;
	tasks: Array<{
		title: string;
		status: string;
		priority: string;
		project: string | null;
		sprint: string | null;
		blocked: boolean;
		dueDate: Date | null;
	}>;
	roleGroup: {
		name: string;
		description: string | null;
		instructions: Array<{ filename: string; title: string | null; content: string }>;
		skills: Array<{ name: string; level: string; description: string | null }>;
	} | null;
	agentPrompt: string;
};

function truncate(value: string, max: number) {
	if (max <= 0) return '';
	return value.length <= max ? value : value.slice(0, max);
}

function formatDate(value: Date | null) {
	return value ? value.toISOString().slice(0, 10) : 'Not available';
}

function appendSection(sections: string[], section: string, minimumReserve = 0) {
	const current = sections.filter(Boolean).join('\n\n');
	const separatorLength = current ? 2 : 0;
	const remaining = MAX_SYSTEM_PROMPT_CHARS - current.length - separatorLength - minimumReserve;
	if (remaining <= 0) return;
	sections.push(truncate(section, remaining));
}

function groundingRules() {
	return [
		'=== GROUNDING RULES ===',
		'AgentHQ grounding rules:',
		'- For questions about teammates, teams, agents, roles, projects, sprints, tasks, assignments, or current status, use only the AgentHQ context provided in this prompt.',
		'- Never invent people, names, roles, teams, assignments, projects, tasks, sprint names, or statuses.',
		'- If the requested information is not present in the AgentHQ context, say that the information is not currently available.',
		'- Do not infer organizational facts from naming patterns.',
		'- Do not assume a person exists because a similar name appears in chat history.',
		'- Treat AgentHQ context as the source of truth for current organizational state.',
		'- If conversation history conflicts with current AgentHQ facts, follow the current AgentHQ facts.',
	].join('\n');
}

export async function buildAgentHQContext(agentId: string): Promise<AgentHQContext> {
	const agent = await prisma.agent.findUnique({
		where: { id: agentId },
		include: {
			member: {
				include: {
					team: {
						include: {
							members: {
								include: { agents: true },
								orderBy: { name: 'asc' },
							},
							project: true,
						},
					},
				},
			},
			tasks: {
				where: { status: { in: Array.from(ACTIVE_TASK_STATUSES) } },
				include: { project: true, sprint: true },
				orderBy: [{ status: 'asc' }, { priority: 'desc' }, { updatedAt: 'desc' }],
				take: MAX_TASKS_IN_PROMPT,
			},
		},
	});
	if (!agent) throw new Error('Agent not found');

	const config = parseJsonConfig(agent.config);
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

	const team = agent.member.team;
	const allTeammates: AgentHQContext['teammates'] = team?.members.flatMap<AgentHQContext['teammates'][number]>((member) => {
		if (member.id === agent.memberId) return [];
		if (member.type === 'human') {
			return [{ name: member.name, role: member.role, type: 'human' as const }];
		}
		if (member.agents.length > 0) {
			return member.agents
				.filter((teammateAgent) => teammateAgent.id !== agent.id)
				.map((teammateAgent) => ({
					name: teammateAgent.name,
					role: member.role,
					type: 'ai' as const,
					status: teammateAgent.status,
				}));
		}
		return [{ name: member.name, role: member.role, type: 'ai' as const }];
	}) || [];

	const sprint = agent.tasks.find((task) => task.sprint?.status === 'active')?.sprint
		|| agent.tasks.find((task) => task.sprint)?.sprint
		|| null;

	return {
		agent: {
			name: agent.name,
			role: agent.member.role,
			type: 'ai',
			status: agent.status,
			provider: agent.type,
			model: agent.model,
		},
		team: team ? {
			name: team.name,
			description: team.description,
			status: team.status,
		} : null,
		teammates: allTeammates.slice(0, MAX_TEAM_MEMBERS_IN_PROMPT),
		teammateCount: allTeammates.length,
		project: team?.project ? {
			name: team.project.name,
			description: team.project.description,
			status: team.project.status,
			progress: team.project.progress,
			repoUrl: team.project.repoUrl,
		} : null,
		sprint: sprint ? {
			name: sprint.name,
			goal: sprint.goal,
			status: sprint.status,
			startDate: sprint.startDate,
			endDate: sprint.endDate,
		} : null,
		tasks: agent.tasks.map((task) => ({
			title: task.title,
			status: task.status,
			priority: task.priority,
			project: task.project?.name || null,
			sprint: task.sprint?.name || null,
			blocked: task.blocked,
			dueDate: task.dueDate,
		})),
		roleGroup: assignment?.roleGroup ? {
			name: assignment.roleGroup.name,
			description: assignment.roleGroup.description,
			instructions: assignment.roleGroup.instructions.map((instruction) => ({
				filename: instruction.filename,
				title: instruction.title,
				content: instruction.content,
			})),
			skills: assignment.roleGroup.skills.map((skill) => ({
				name: skill.name,
				level: skill.level,
				description: skill.description,
			})),
		} : null,
		agentPrompt: typeof config.systemPrompt === 'string' ? config.systemPrompt.trim() : '',
	};
}

function renderFacts(context: AgentHQContext) {
	const teammates = context.teammates.length > 0
		? [
			...context.teammates.map((teammate) =>
				`- ${teammate.name} — ${teammate.role} — ${teammate.type === 'human' ? 'Human' : 'AI Agent'}${teammate.status ? ` — ${teammate.status}` : ''}`
			),
			...(context.teammateCount > context.teammates.length
				? [`Showing ${context.teammates.length} of ${context.teammateCount} current team members.`]
				: []),
		].join('\n')
		: 'No other team members are currently assigned.';

	const tasks = context.tasks.length > 0
		? context.tasks.map((task) =>
			[
				`- ${task.title}`,
				`Task status: ${task.status}`,
				`Priority: ${task.priority}`,
				`Project: ${task.project || 'Not available in AgentHQ'}`,
				`Sprint: ${task.sprint || 'Not available in AgentHQ'}`,
				`Blocked: ${task.blocked ? 'yes' : 'no'}`,
				`Due date: ${formatDate(task.dueDate)}`,
			].join(' — ')
		).join('\n')
		: 'No active tasks are currently assigned.';

	return [
		'=== AGENTHQ FACTS ===',
		'Your AgentHQ identity:',
		`Name: ${context.agent.name}`,
		`Role: ${context.agent.role}`,
		'Type: AI Agent',
		`Agent status: ${context.agent.status}`,
		`Provider/model: ${context.agent.provider} / ${context.agent.model}`,
		`Role Group: ${context.roleGroup?.name || 'Not available in AgentHQ'}`,
		'Manager: Not available in AgentHQ.',
		'',
		'Current team:',
		context.team?.name || 'No team is currently assigned.',
		'',
		'Team description:',
		context.team?.description || 'Not available in AgentHQ.',
		'',
		'Team status:',
		context.team?.status || 'Not available in AgentHQ.',
		'',
		'Current team members:',
		teammates,
		'',
		'Current project:',
		context.project
			? [
				context.project.name,
				`Project status: ${context.project.status}`,
				`Progress: ${context.project.progress}%`,
				`Description: ${context.project.description || 'Not available in AgentHQ.'}`,
				`Repository URL: ${context.project.repoUrl || 'Not available in AgentHQ.'}`,
			].join('\n')
			: 'No project is currently assigned to this team.',
		'',
		'Current sprint:',
		context.sprint
			? [
				context.sprint.name,
				`Sprint status: ${context.sprint.status}`,
				`Goal: ${context.sprint.goal || 'Not available in AgentHQ.'}`,
				`Start date: ${formatDate(context.sprint.startDate)}`,
				`End date: ${formatDate(context.sprint.endDate)}`,
			].join('\n')
			: 'No active sprint is currently assigned.',
		'',
		'Current assigned tasks:',
		tasks,
	].join('\n');
}

function renderRoleContext(context: AgentHQContext) {
	if (!context.roleGroup) {
		return [
			'=== ROLE CONTEXT ===',
			'Role Group: Not available in AgentHQ.',
			'Role instructions: Not available in AgentHQ.',
			'Skills: Not available in AgentHQ.',
		].join('\n');
	}

	let remainingInstructionChars = MAX_TOTAL_INSTRUCTION_CHARS;
	const instructions = context.roleGroup.instructions
		.map((instruction) => {
			if (remainingInstructionChars <= 0) return '';
			const content = truncate(instruction.content, Math.min(MAX_INSTRUCTION_CHARS, remainingInstructionChars));
			remainingInstructionChars -= content.length;
			return `- ${instruction.title || instruction.filename}:\n${content}`;
		})
		.filter(Boolean);

	const skills = context.roleGroup.skills.slice(0, MAX_SKILLS).map((skill) =>
		`- ${skill.name}: ${skill.level}${skill.description ? ` (${skill.description})` : ''}`
	);

	return [
		'=== ROLE CONTEXT ===',
		`Role Group: ${context.roleGroup.name}`,
		`Role Group description: ${context.roleGroup.description || 'Not available in AgentHQ.'}`,
		'Role instructions:',
		instructions.length > 0 ? instructions.join('\n\n') : 'Not available in AgentHQ.',
		'',
		'Skills:',
		skills.length > 0 ? skills.join('\n') : 'Not available in AgentHQ.',
	].join('\n');
}

export async function buildAgentSystemPrompt(agentId: string, fallbackPrompt: string) {
	const context = await buildAgentHQContext(agentId);
	const rules = groundingRules();
	const sections = [rules];

	appendSection(sections, renderFacts(context), 4000);
	appendSection(sections, `=== BASE BEHAVIOR ===\n${fallbackPrompt || 'Be concise, practical, and task-focused.'}`, 3000);
	appendSection(sections, renderRoleContext(context), 1500);

	if (context.agentPrompt) {
		appendSection(sections, `=== AGENT-SPECIFIC INSTRUCTIONS ===\n${context.agentPrompt}`);
	} else {
		appendSection(sections, '=== AGENT-SPECIFIC INSTRUCTIONS ===\nNot available in AgentHQ.');
	}

	const prompt = sections.filter(Boolean).join('\n\n');
	return truncate(prompt, MAX_SYSTEM_PROMPT_CHARS);
}
