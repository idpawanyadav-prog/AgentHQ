import type { AgentExecutionEngine } from './engine';
import { apiChatEngine } from './engines/api-chat';
import { apiToolsEngine } from './engines/api-tools';
import { FakeExecutionEngine } from './engines/fake';

export const executionEngines = new Map<string, AgentExecutionEngine>();

executionEngines.set('api-chat', apiChatEngine);
executionEngines.set('api-tools', apiToolsEngine);
executionEngines.set('fake', new FakeExecutionEngine());

if (process.env.ENABLE_OPENAI_TOOL_ENGINE === 'true') {
	// Placeholder for future engine registration.
}
if (process.env.ENABLE_CODEX_ENGINE === 'true') {
	// Placeholder for future engine registration.
}
if (process.env.ENABLE_CLAUDE_CODE_ENGINE === 'true') {
	// Placeholder for future engine registration.
}

export function getExecutionEngine(name: string) {
	const engine = executionEngines.get(name);
	if (!engine) throw new Error(`Execution engine is not available: ${name}`);
	return engine;
}
