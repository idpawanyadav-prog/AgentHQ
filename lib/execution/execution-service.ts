import prisma from '../prisma';
import { DEFAULT_COMMAND_POLICY, DEVELOPER_TOOL_POLICY, READ_ONLY_TOOL_POLICY, type CommandPolicy, type ToolPolicy } from './engine';
import { getExecutionEngine } from './engine-registry';
import { createLocalCommit, gitChangedFiles, gitCommittedDiff, gitDiff, prepareWorkspace } from '../workspace/workspace-service';
import { evaluateExecutionGates } from '../governance/execution-gates';
import { enqueueExecutionJob } from '../job-queue';
import { readConfiguredModels } from '../configured-models';

export type ExecutionProposalInput = {
	projectId: string;
	taskId?: string;
	agentId?: string;
	squadId?: string;
	engine?: string;
	message: string;
	mode?: 'analysis' | 'coding';
	configuredModelId?: string;
};

export async function proposeExecution(input: ExecutionProposalInput) {
	const project = await prisma.project.findUnique({ where: { id: input.projectId }, include: { tasks: true, team: true } });
	if (!project) throw new Error('Project not found');
	const mode = input.mode || (input.engine === 'api-chat' ? 'analysis' : 'coding');
	const gates = await evaluateExecutionGates(project.id, mode);
	const models = await readConfiguredModels();
	const configuredModel = input.configuredModelId
		? models.find((model) => model.id === input.configuredModelId)
		: project.defaultCodingModelId
			? models.find((model) => model.id === project.defaultCodingModelId)
			: models.find((model) => model.executionEngine === 'api-tools' || model.supportsTools) || models[0];
	if (mode === 'coding' && !configuredModel) gates.blockers.push('Configure a coding model before execution.');
	const branch = `agent/${input.taskId || 'project'}-${input.message.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'run'}`;
	const commands = mode === 'coding'
		? DEFAULT_COMMAND_POLICY.allowedCommands.filter((argv) => ['npm run typecheck', 'npm test', 'npm run build'].includes(argv.join(' ')))
		: [];
	const proposal = {
		id: '',
		projectId: project.id,
		taskId: input.taskId || null,
		agentId: input.agentId || null,
		squadId: input.squadId || null,
		engine: input.engine || (mode === 'analysis' ? 'api-chat' : configuredModel?.executionEngine || 'api-tools'),
		configuredModelId: configuredModel?.id || null,
		modelName: configuredModel?.name || null,
		provider: configuredModel?.provider || null,
		mode,
		branch,
		commands,
		risk: mode === 'analysis' ? 'LOW' : 'MEDIUM',
		implications: mode === 'analysis'
			? ['read-only analysis will be recorded', 'no files will be modified']
			: ['repository files may be modified inside an isolated workspace', 'a new branch will be created', 'a local commit may be created', 'no remote push occurs without separate approval'],
		affectedEntities: ['Project', ...(input.taskId ? ['Task'] : []), ...(input.agentId ? ['Agent'] : []), ...(input.squadId ? ['Squad'] : [])],
		approvalRequired: true,
		blockers: gates.blockers,
		warnings: gates.warnings,
		message: input.message,
	};
	const saved = await prisma.executionProposal.create({
		data: {
			projectId: proposal.projectId,
			taskId: proposal.taskId,
			agentId: proposal.agentId,
			squadId: proposal.squadId,
			configuredModelId: proposal.configuredModelId,
			engine: proposal.engine,
			mode: proposal.mode,
			prompt: proposal.message,
			branch: proposal.branch,
			commands: JSON.stringify(proposal.commands),
			implications: JSON.stringify(proposal.implications),
			blockers: JSON.stringify(proposal.blockers),
			warnings: JSON.stringify(proposal.warnings),
		},
	});
	await prisma.activity.create({
		data: {
			teamId: project.teamId,
			type: 'execution_proposed',
			description: `Execution proposed for ${project.name}`,
			meta: JSON.stringify({ projectId: project.id, taskId: input.taskId, engine: proposal.engine, risk: proposal.risk, blockers: proposal.blockers }),
		},
	});
	return { ...proposal, id: saved.id, proposalId: saved.id };
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
	if (!value) return fallback;
	try { return JSON.parse(value) as T; } catch { return fallback; }
}

export async function approveExecutionProposal(proposalId: string, approved: boolean) {
	if (!approved) {
		const error = new Error('Explicit approval is required.');
		(error as Error & { status?: number }).status = 400;
		throw error;
	}
	const proposal = await prisma.executionProposal.findUnique({ where: { id: proposalId } });
	if (!proposal) throw new Error('Execution proposal not found');
	if (proposal.status !== 'pending') throw new Error('Execution proposal is no longer pending');
	const blockers = parseJson<string[]>(proposal.blockers, []);
	if (blockers.length > 0) throw new Error(`Execution is blocked: ${blockers.join(' ')}`);
	const project = await prisma.project.findUnique({ where: { id: proposal.projectId }, include: { team: true } });
	if (!project) throw new Error('Project not found');
	const gates = await evaluateExecutionGates(project.id, proposal.mode === 'analysis' ? 'analysis' : 'coding');
	if (!gates.allowed) throw new Error(`Execution is blocked: ${gates.blockers.join(' ')}`);
	if (proposal.taskId) {
		const task = await prisma.task.findUnique({ where: { id: proposal.taskId } });
		if (!task || task.projectId !== project.id || task.teamId !== project.teamId) throw new Error('Task does not belong to this Project.');
		if (!['ready', 'in_progress'].includes(task.status)) throw new Error('Task must be ready or in progress before execution.');
	}
	if (proposal.agentId) {
		const agent = await prisma.agent.findUnique({ where: { id: proposal.agentId }, include: { member: true } });
		if (!agent || agent.member.teamId !== project.teamId) throw new Error('Agent does not belong to this Project team.');
		if (agent.status === 'working') throw new Error('Agent is already working.');
	}
	const tools: ToolPolicy = proposal.mode === 'analysis' ? READ_ONLY_TOOL_POLICY : DEVELOPER_TOOL_POLICY;
	const commandPolicy: CommandPolicy = proposal.mode === 'analysis' ? { ...DEFAULT_COMMAND_POLICY, allowedCommands: [] } : DEFAULT_COMMAND_POLICY;
	const engine = getExecutionEngine(proposal.engine);
	const validation = await engine.validate({ projectId: project.id, engine: proposal.engine, tools, commandPolicy });
	if (!validation.ok) throw new Error(validation.reasons.join('; ') || 'Engine validation failed');

	const run = await prisma.$transaction(async (tx) => {
		const created = await tx.executionRun.create({
		data: {
			projectId: project.id,
			taskId: proposal.taskId,
			agentId: proposal.agentId,
			squadId: proposal.squadId,
			engine: proposal.engine,
			configuredModelId: proposal.configuredModelId,
			status: 'queued',
		},
	});
		await tx.executionProposal.update({ where: { id: proposal.id }, data: { status: 'queued', approvedAt: new Date(), appliedAt: new Date() } });
		return created;
	});
	const job = await enqueueExecutionJob({ executionRunId: run.id, teamId: project.teamId, agentId: proposal.agentId || undefined, taskId: proposal.taskId || undefined });
	await prisma.executionRun.update({ where: { id: run.id }, data: { jobId: job.id } });
	await prisma.activity.create({
		data: {
			teamId: project.teamId,
			type: 'execution_approved',
			description: `Execution approved for ${project.name}`,
			meta: JSON.stringify({ projectId: project.id, runId: run.id, engine: proposal.engine }),
		},
	});
	return { executionRunId: run.id, status: 'queued', jobId: job.id };
}

export async function approveExecution(proposal: Awaited<ReturnType<typeof proposeExecution>>, approved: boolean) {
	return approveExecutionProposal(proposal.id || proposal.proposalId, approved);
}

export async function executeRun(runId: string, taskPrompt?: string, tools?: ToolPolicy, commandPolicy?: CommandPolicy) {
	const run = await prisma.executionRun.findUnique({ where: { id: runId }, include: { project: true } });
	if (!run) throw new Error('ExecutionRun not found');
	const engine = getExecutionEngine(run.engine);
	const project = run.project;
	const proposal = await prisma.executionProposal.findFirst({ where: { projectId: project.id, taskId: run.taskId, agentId: run.agentId, status: { in: ['queued', 'running'] } }, orderBy: { createdAt: 'desc' } });
	const prompt = taskPrompt || proposal?.prompt || 'Complete the approved execution.';
	await prisma.$transaction(async (tx) => {
		await tx.executionRun.update({ where: { id: runId }, data: { status: 'running', startedAt: new Date(), heartbeatAt: new Date() } });
		if (run.agentId) await tx.agent.update({ where: { id: run.agentId }, data: { status: 'working' } });
		if (run.taskId) await tx.task.updateMany({ where: { id: run.taskId, status: { in: ['ready', 'in_progress'] } }, data: { status: 'in_progress', agentId: run.agentId || undefined } });
	});
	const workspace = await prepareWorkspace(project.id, run.id, {
		taskId: run.taskId,
		prompt,
		repoUrl: project.repositoryMode === 'local' || project.repositoryMode === 'github' ? project.repoUrl : null,
		defaultBranch: project.defaultBranch,
	});
	await prisma.executionCheckpoint.create({ data: { executionRunId: run.id, phase: 'before_execution' } });

	try {
		const result = await engine.execute({
			runId: run.id,
			projectId: project.id,
			workspacePath: workspace.path,
			systemPrompt: 'Never claim code was edited unless an ExecutionRun recorded changes. Never claim tests passed unless command records confirm success. Never claim a branch exists unless Git operations confirm it. Never claim a commit exists unless Git confirms it.',
			taskPrompt: prompt,
			model: { configuredModelId: run.configuredModelId || undefined },
			tools: tools || DEVELOPER_TOOL_POLICY,
			commandPolicy: commandPolicy || DEFAULT_COMMAND_POLICY,
			timeoutMs: 20 * 60_000,
			maxToolTurns: 50,
		});
		const changedFiles = result.changedFiles.length ? result.changedFiles : gitChangedFiles(workspace.path);
		let headCommit: string | undefined;
		const validation = await runMandatoryValidation(workspace.path, project.validationCommands, commandPolicy || DEFAULT_COMMAND_POLICY);
		if (result.status === 'success' && !validation.every((item) => item.exitCode === 0)) {
			result.status = 'failed';
			result.failureReason = 'Mandatory validation failed';
		}
		if (result.status === 'success' && changedFiles.length > 0 && (tools || DEVELOPER_TOOL_POLICY).gitCommit) {
			const commit = createLocalCommit(workspace.path, `agent: ${prompt.slice(0, 72)}`);
			headCommit = commit.headCommit;
			await prisma.executionCheckpoint.create({ data: { executionRunId: run.id, phase: 'commit_created', gitCommit: headCommit } });
		}
		const terminalStatus = result.status === 'success' ? changedFiles.length > 0 ? 'completed' : 'completed' : result.status;
		const updated = await prisma.$transaction(async (tx) => {
			const next = await tx.executionRun.update({
				where: { id: run.id },
				data: {
					status: terminalStatus,
					outcome: result.status,
					failureReason: result.failureReason || null,
					finishedAt: new Date(),
					exitCode: result.exitCode,
					timedOut: result.timedOut,
					inputTokens: result.usage.inputTokens,
					outputTokens: result.usage.outputTokens,
					totalTokens: result.usage.totalTokens,
					costUsd: result.usage.costUsd,
					resultSummary: result.output.slice(0, 4000),
					changedFiles: JSON.stringify(changedFiles),
					artifacts: JSON.stringify(result.artifacts),
					commands: JSON.stringify(result.commands),
					validation: JSON.stringify(validation),
					commitSha: headCommit,
				},
			});
			await tx.workspace.update({ where: { id: workspace.id }, data: { status: terminalStatus === 'completed' ? 'completed' : 'failed', headCommit } });
			await tx.executionCheckpoint.create({ data: { executionRunId: run.id, phase: terminalStatus === 'completed' ? 'completed' : 'after_file_changes', gitCommit: headCommit, metadata: JSON.stringify({ changedFiles }) } });
			if (run.taskId && terminalStatus === 'completed') await tx.task.updateMany({ where: { id: run.taskId, status: 'in_progress' }, data: { status: 'review' } });
			if (run.agentId) await tx.agent.updateMany({ where: { id: run.agentId }, data: { status: terminalStatus === 'completed' ? 'idle' : 'idle' } });
			if (proposal) await tx.executionProposal.update({ where: { id: proposal.id }, data: { status: terminalStatus === 'completed' ? 'completed' : 'failed' } });
			await tx.projectExecutionState.upsert({
				where: { projectId: project.id },
				create: { projectId: project.id, phase: terminalStatus === 'completed' ? 'reviewing' : 'blocked', lastRunId: run.id, summary: result.output.slice(0, 2000) },
				update: { phase: terminalStatus === 'completed' ? 'reviewing' : 'blocked', lastRunId: run.id, summary: result.output.slice(0, 2000) },
			});
			await tx.activity.create({
				data: {
					teamId: project.teamId,
					type: terminalStatus === 'completed' ? 'execution_completed' : 'execution_failed',
					description: terminalStatus === 'completed' ? 'Execution completed' : 'Execution failed',
					meta: JSON.stringify({ projectId: project.id, runId: run.id, changedFiles, diffPreview: gitCommittedDiff(workspace.path, workspace.baseCommit, headCommit).slice(0, 4000) }),
				},
			});
			return next;
		});
		return updated;
	} catch (err) {
		await prisma.executionRun.update({ where: { id: run.id }, data: { status: 'failed', failureReason: err instanceof Error ? err.message : 'Execution failed', finishedAt: new Date() } });
		await prisma.workspace.update({ where: { id: workspace.id }, data: { status: 'failed' } });
		if (run.agentId) await prisma.agent.updateMany({ where: { id: run.agentId }, data: { status: 'idle' } });
		await prisma.activity.create({
			data: {
				teamId: project.teamId,
				type: 'execution_failed',
				description: 'Execution failed',
				meta: JSON.stringify({ projectId: project.id, runId: run.id }),
			},
		});
		throw err;
	}
}

async function runMandatoryValidation(workspacePath: string, projectCommands: string | null, policy: CommandPolicy) {
	const { runCommandTool } = await import('../tools/command-tools');
	const configured = parseJson<string[][]>(projectCommands, []);
	const commands = configured.length ? configured : policy.allowedCommands.filter((argv) => ['npm run typecheck', 'npm test', 'npm run build'].includes(argv.join(' ')));
	const results = [];
	for (const argv of commands) {
		try {
			const result = await runCommandTool(workspacePath, argv, { ...policy, allowedCommands: [...policy.allowedCommands, ...commands] });
			results.push({ argv: result.argv, exitCode: result.exitCode, durationMs: result.durationMs, stdout: result.stdout.slice(-2000), stderr: result.stderr.slice(-2000) });
		} catch (err) {
			results.push({ argv, exitCode: 1, durationMs: 0, stdout: '', stderr: err instanceof Error ? err.message : 'Validation failed' });
		}
	}
	return results;
}

export async function listProjectRuns(projectId: string) {
	return prisma.executionRun.findMany({
		where: { projectId },
		orderBy: { createdAt: 'desc' },
		take: 20,
		include: { workspaces: true },
	});
}

export async function recoverStaleExecutionRuns() {
	const threshold = new Date(Date.now() - 60_000);
	const stale = await prisma.executionRun.findMany({ where: { status: 'running', OR: [{ heartbeatAt: { lt: threshold } }, { heartbeatAt: null }] } });
	for (const run of stale) {
		await prisma.executionRun.update({ where: { id: run.id }, data: { status: 'interrupted', failureReason: 'Execution heartbeat expired', finishedAt: new Date() } });
		await prisma.workspace.updateMany({ where: { executionRunId: run.id }, data: { status: 'cleanup_pending' } });
		const project = await prisma.project.findUnique({ where: { id: run.projectId } });
		if (project) {
			await prisma.activity.create({
				data: {
					teamId: project.teamId,
					type: 'execution_interrupted',
					description: 'Execution interrupted by stale heartbeat recovery',
					meta: JSON.stringify({ projectId: run.projectId, runId: run.id }),
				},
			});
		}
	}
	return stale.length;
}
