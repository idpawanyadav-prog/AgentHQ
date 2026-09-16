import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import { FakeExecutionEngine } from '../lib/execution/engines/fake';
import { DEFAULT_COMMAND_POLICY, DEVELOPER_TOOL_POLICY } from '../lib/execution/engine';

it('fake engine returns normalized successful execution results', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agenthq-engine-'));
	const engine = new FakeExecutionEngine();

	const result = await engine.execute({
		runId: 'run-1',
		projectId: 'project-1',
		workspacePath: root,
		systemPrompt: 'system',
		taskPrompt: 'Implement a fake change',
		model: {},
		tools: DEVELOPER_TOOL_POLICY,
		commandPolicy: { ...DEFAULT_COMMAND_POLICY, allowedCommands: [] },
		timeoutMs: 1000,
		maxToolTurns: 5,
	});

	expect(result.status).toBe('success');
	expect(result.changedFiles).toEqual(['agenthq-runtime/run-1.txt']);
	expect(result.usage.totalTokens).toBe(20);
	expect(result.timedOut).toBe(false);
});

it('fake engine simulates failure and timeout without provider access', async () => {
	const root = await fs.mkdtemp(path.join(os.tmpdir(), 'agenthq-engine-'));
	const engine = new FakeExecutionEngine();
	await expect(engine.execute({
		runId: 'run-2',
		projectId: 'project-1',
		workspacePath: root,
		systemPrompt: 'system',
		taskPrompt: 'SIMULATE_FAILURE',
		model: {},
		tools: DEVELOPER_TOOL_POLICY,
		commandPolicy: { ...DEFAULT_COMMAND_POLICY, allowedCommands: [] },
		timeoutMs: 1000,
		maxToolTurns: 5,
	})).resolves.toMatchObject({ status: 'failed', failureReason: 'Simulated failure' });
});
