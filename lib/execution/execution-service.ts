import prisma from '../prisma';
import { DEFAULT_COMMAND_POLICY, DEVELOPER_TOOL_POLICY, READ_ONLY_TOOL_POLICY, type CommandPolicy, type ToolPolicy } from './engine';
import { getExecutionEngine } from './engine-registry';
import { createLocalCommit, gitChangedFiles, gitDiff, prepareWorkspace } from '../workspace/workspace-service';
import { evaluateExecutionGates } from '../governance/execution-gates';

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
	const branch = `agent/${input.taskId || 'project'}-${input.message.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 50) || 'run'}`;
	const commands = mode === 'coding'
		? DEFAULT_COMMAND_POLICY.allowedCommands.filter((argv) => ['npm run typecheck', 'npm test', 'npm run build'].includes(argv.join(' ')))
		: [];
	const proposal = {
		projectId: project.id,
		taskId: input.taskId || null,
		agentId: input.agentId || null,
		squadId: input.squadId || null,
		engine: input.engine || (mode === 'analysis' ? 'api-chat' : 'fake'),
		configuredModelId: input.configuredModelId || null,
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
	await prisma.activity.create({
		data: {
			teamId: project.teamId,
			type: 'execution_proposed',
			description: `Execution proposed for ${project.name}`,
			meta: JSON.stringify({ projectId: project.id, taskId: input.taskId, engine: proposal.engine, risk: proposal.risk, blockers: proposal.blockers }),
		},
	});
	return proposal;
}

export async function approveExecution(proposal: Awaited<ReturnType<typeof proposeExecution>>, approved: boolean) {
	if (!approved) {
		const error = new Error('Explicit approval is required.');
		(error as Error & { status?: number }).status = 400;
		throw error;
	}
	if (proposal.blockers.length > 0) throw new Error(`Execution is blocked: ${proposal.blockers.join(' ')}`);
	const project = await prisma.project.findUnique({ where: { id: proposal.projectId } });
	if (!project) throw new Error('Project not found');
	const tools: ToolPolicy = proposal.mode === 'analysis' ? READ_ONLY_TOOL_POLICY : DEVELOPER_TOOL_POLICY;
	const commandPolicy: CommandPolicy = proposal.mode === 'analysis' ? { ...DEFAULT_COMMAND_POLICY, allowedCommands: [] } : DEFAULT_COMMAND_POLICY;
	const engine = getExecutionEngine(proposal.engine);
	const validation = await engine.validate({ projectId: project.id, engine: proposal.engine, tools, commandPolicy });
	if (!validation.ok) throw new Error(validation.reasons.join('; ') || 'Engine validation failed');

	const run = await prisma.executionRun.create({
		data: {
			projectId: project.id,
			taskId: proposal.taskId,
			agentId: proposal.agentId,
			squadId: proposal.squadId,
			engine: proposal.engine,
			configuredModelId: proposal.configuredModelId,
			status: 'preparing',
		},
	});
	await prisma.activity.create({
		data: {
			teamId: project.teamId,
			type: 'execution_approved',
			description: `Execution approved for ${project.name}`,
			meta: JSON.stringify({ projectId: project.id, runId: run.id, engine: proposal.engine }),
		},
	});

	return executeRun(run.id, proposal.message, tools, commandPolicy);
}

export async function executeRun(runId: string, taskPrompt: string, tools?: ToolPolicy, commandPolicy?: CommandPolicy) {
	const run = await prisma.executionRun.findUnique({ where: { id: runId }, include: { project: true } });
	if (!run) throw new Error('ExecutionRun not found');
	const engine = getExecutionEngine(run.engine);
	const project = run.project;
	await prisma.executionRun.update({ where: { id: runId }, data: { status: 'running', startedAt: new Date(), heartbeatAt: new Date() } });
	const workspace = await prepareWorkspace(project.id, run.id, {
		taskId: run.taskId,
		prompt: taskPrompt,
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
			taskPrompt,
			model: { configuredModelId: run.configuredModelId || undefined },
			tools: tools || DEVELOPER_TOOL_POLICY,
			commandPolicy: commandPolicy || DEFAULT_COMMAND_POLICY,
			timeoutMs: 20 * 60_000,
			maxToolTurns: 50,
		});
		const changedFiles = result.changedFiles.length ? result.changedFiles : gitChangedFiles(workspace.path);
		let headCommit: string | undefined;
		if (result.status === 'success' && changedFiles.length > 0 && (tools || DEVELOPER_TOOL_POLICY).gitCommit) {
			const commit = createLocalCommit(workspace.path, `agent: ${taskPrompt.slice(0, 72)}`);
			headCommit = commit.headCommit;
			await prisma.executionCheckpoint.create({ data: { executionRunId: run.id, phase: 'commit_created', gitCommit: headCommit } });
		}
		const terminalStatus = result.status === 'success' ? 'completed' : result.status;
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
				},
			});
			await tx.workspace.update({ where: { id: workspace.id }, data: { status: terminalStatus === 'completed' ? 'completed' : 'failed', headCommit } });
			await tx.executionCheckpoint.create({ data: { executionRunId: run.id, phase: terminalStatus === 'completed' ? 'completed' : 'after_file_changes', gitCommit: headCommit, metadata: JSON.stringify({ changedFiles }) } });
			if (run.taskId && terminalStatus === 'completed') await tx.task.updateMany({ where: { id: run.taskId, status: 'in_progress' }, data: { status: 'review' } });
			await tx.activity.create({
				data: {
					teamId: project.teamId,
					type: terminalStatus === 'completed' ? 'execution_completed' : 'execution_failed',
					description: terminalStatus === 'completed' ? 'Execution completed' : 'Execution failed',
					meta: JSON.stringify({ projectId: project.id, runId: run.id, changedFiles, diffPreview: gitDiff(workspace.path).slice(0, 4000) }),
				},
			});
			return next;
		});
		return updated;
	} catch (err) {
		await prisma.executionRun.update({ where: { id: run.id }, data: { status: 'failed', failureReason: err instanceof Error ? err.message : 'Execution failed', finishedAt: new Date() } });
		await prisma.workspace.update({ where: { id: workspace.id }, data: { status: 'failed' } });
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
