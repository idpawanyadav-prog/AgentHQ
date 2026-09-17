import type { AgentToolContext, AgentToolDefinition, AgentToolResult } from './types';
import { getAgentTool, listAgentTools } from './registry';
import { validateToolActor, validateToolPermission } from './permissions';
import { validateToolArguments } from './validation';
import type { NormalizedToolCall } from '../execution/providers/types';

export type NormalizedToolResult = {
  toolCallId: string;
  toolName: string;
  ok: boolean;
  data?: unknown;
  error?: {
    code: string;
    message: string;
  };
  proposalId?: string;
  implications?: unknown;
};

export async function executeAgentToolCall(
  call: NormalizedToolCall,
  context: AgentToolContext,
): Promise<NormalizedToolResult> {
  const tool = getAgentTool(call.name);

  if (!tool) {
    return {
      toolCallId: call.id,
      toolName: call.name,
      ok: false,
      error: {
        code: 'TOOL_NOT_FOUND',
        message: `Unknown tool: ${call.name}`,
      },
    };
  }

  try {
    validateToolActor(tool, context);
    validateToolPermission(tool, context);
  } catch (err) {
    return {
      toolCallId: call.id,
      toolName: call.name,
      ok: false,
      error: {
        code: (err instanceof Error && (err as Error & { code?: string }).code) || 'PERMISSION_DENIED',
        message: err instanceof Error ? err.message : 'Permission denied',
      },
    };
  }

  const args = validateToolArguments(tool.inputSchema, call.arguments || {});

  try {
    const result = await tool.execute(args, context);
    return normalizeToolResult(call.id, tool.name, result);
  } catch (err) {
    return {
      toolCallId: call.id,
      toolName: tool.name,
      ok: false,
      error: {
        code: 'EXECUTION_ERROR',
        message: err instanceof Error ? err.message : 'Tool execution failed',
      },
    };
  }
}

export function normalizeToolResult(
  toolCallId: string,
  toolName: string,
  result: AgentToolResult,
): NormalizedToolResult {
  return {
    toolCallId,
    toolName,
    ok: result.ok,
    data: result.data,
    error: result.error,
    proposalId: result.proposalId,
    implications: result.implications,
  };
}

export function getToolsForContext(
  context: AgentToolContext,
): AgentToolDefinition[] {
  return listAgentTools().filter((tool) => {
    if (!tool.allowedActors.includes(context.actorType)) return false;
    return true;
  });
}
