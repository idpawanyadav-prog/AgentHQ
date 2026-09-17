import type { AgentToolDefinition, AgentToolContext } from './types';
import { getToolsForContext } from './runtime';
import type { ApiToolDefinition } from '../execution/providers/types';

function toAnthropicTool(tool: AgentToolDefinition): Record<string, unknown> {
  return {
    name: tool.name,
    description: tool.description,
    input_schema: tool.inputSchema,
  };
}

function toOpenAITool(tool: AgentToolDefinition): Record<string, unknown> {
  return {
    type: 'function',
    function: {
      name: tool.name,
      description: tool.description,
      parameters: tool.inputSchema,
    },
  };
}

export function getToolsForContextFiltered(context: AgentToolContext): AgentToolDefinition[] {
  return getToolsForContext(context);
}

export function toApiToolDefinitions(tools: AgentToolDefinition[]): ApiToolDefinition[] {
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.inputSchema,
  }));
}

export function convertToProviderTools(
  context: AgentToolContext,
  provider: 'anthropic' | 'openai' | 'custom',
): ApiToolDefinition[] {
  const tools = getToolsForContextFiltered(context);
  if (provider === 'anthropic') {
    return tools.map((tool) => ({
      name: tool.name,
      description: tool.description,
      parameters: toAnthropicTool(tool).input_schema as Record<string, unknown>,
    }));
  }
  return tools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: (toOpenAITool(tool).function as Record<string, unknown>).parameters as Record<string, unknown>,
  }));
}
