import prisma from '../prisma';
import {
  getAgentTool,
  listAgentTools,
  registerAgentTool,
  clearAgentTools,
} from './registry';
import {
  executeAgentToolCall,
  normalizeToolResult,
  getToolsForContext,
  type NormalizedToolResult,
} from './runtime';
import type { AgentToolContext } from './types';
import { getOrganizationStatusTool } from './tools/get-organization-status';
import { getProjectStatusTool } from './tools/get-project-status';
import { getTaskTool } from './tools/get-task';
import { getAgentWorkloadTool } from './tools/get-agent-workload';
import { findBenchAgentsTool } from './tools/find-bench-agents';
import { proposeProjectBootstrapTool } from './tools/propose-project-bootstrap';
import { applyProjectBootstrapTool } from './tools/apply-project-bootstrap';
import { proposeTaskTool } from './tools/propose-task';
import { applyTaskTool } from './tools/apply-task';
import { proposeCapacityChangeTool } from './tools/propose-capacity-change';
import { applyCapacityChangeTool } from './tools/apply-capacity-change';
import { proposeTaskSplitTool } from './tools/propose-task-split';
import { applyTaskSplitTool } from './tools/apply-task-split';
import { assignTaskTool } from './tools/assign-task';
import { proposeExecutionTool } from './tools/propose-execution';
import { getExecutionStatusTool } from './tools/get-execution-status';
import { getProjectMemoryTool } from './tools/get-project-memory';
import { getTaskMemoryTool } from './tools/get-task-memory';
import { getDecisionsTool } from './tools/get-decisions';
import { getCheckpointTool } from './tools/get-checkpoint';
import { getHandoffTool } from './tools/get-handoff';
import { getDeliveryStateTool } from './tools/get-delivery-state';
import { pauseTaskTool } from './tools/pause-task';
import { proposeResumeTaskTool } from './tools/propose-resume-task';
import { proposeReassignTool } from './tools/propose-reassign';
import { getTaskReviewTool } from './tools/get-task-review';
import { submitReviewTool } from './tools/submit-review';
import { submitQaResultTool } from './tools/submit-qa';

let registered = false;

export function ensureAgentToolsRegistered(): void {
  if (registered) return;
  clearAgentTools();
  registerAgentTool(getOrganizationStatusTool);
  registerAgentTool(getProjectStatusTool);
  registerAgentTool(getTaskTool);
  registerAgentTool(getAgentWorkloadTool);
  registerAgentTool(findBenchAgentsTool);
  registerAgentTool(proposeProjectBootstrapTool);
  registerAgentTool(applyProjectBootstrapTool);
  registerAgentTool(proposeTaskTool);
  registerAgentTool(applyTaskTool);
  registerAgentTool(proposeCapacityChangeTool);
  registerAgentTool(applyCapacityChangeTool);
  registerAgentTool(proposeTaskSplitTool);
  registerAgentTool(applyTaskSplitTool);
  registerAgentTool(assignTaskTool);
  registerAgentTool(proposeExecutionTool);
  registerAgentTool(getExecutionStatusTool);
  registerAgentTool(getProjectMemoryTool);
  registerAgentTool(getTaskMemoryTool);
  registerAgentTool(getDecisionsTool);
  registerAgentTool(getCheckpointTool);
  registerAgentTool(getHandoffTool);
  registerAgentTool(getDeliveryStateTool);
  registerAgentTool(pauseTaskTool);
  registerAgentTool(proposeResumeTaskTool);
  registerAgentTool(proposeReassignTool);
  registerAgentTool(getTaskReviewTool);
  registerAgentTool(submitReviewTool);
  registerAgentTool(submitQaResultTool);
  registered = true;
}

export function listManagementTools() {
  ensureAgentToolsRegistered();
  return listAgentTools();
}

export function getManagementTool(name: string) {
  ensureAgentToolsRegistered();
  return getAgentTool(name);
}

export async function executeManagementToolCall(
  call: { id: string; name: string; arguments: Record<string, unknown> },
  context: AgentToolContext,
): Promise<NormalizedToolResult> {
  ensureAgentToolsRegistered();
  return executeAgentToolCall(call, context);
}

export function listManagementToolsForContext(context: AgentToolContext) {
  ensureAgentToolsRegistered();
  return getToolsForContext(context);
}
