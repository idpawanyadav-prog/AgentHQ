import type { ActorType, AgentToolContext, AgentToolDefinition } from './types';

const DEFAULT_TOOL_ACCESS: Record<ActorType, string[]> = {
  'project-control': [
    'get_organization_status',
    'get_project_status',
    'get_task',
    'get_agent_workload',
    'find_bench_agents',
    'propose_project_bootstrap',
    'propose_task',
    'propose_capacity_change',
    'propose_task_split',
    'propose_execution',
    'get_execution_status',
    'get_project_memory',
    'get_task_memory',
    'get_relevant_decisions',
    'get_latest_checkpoint',
    'get_task_handoff',
    'get_project_delivery_state',
    'pause_task',
    'propose_resume_task',
    'propose_task_reassignment',
    'get_task_review',
    'submit_review',
    'submit_qa_result',
  ],
  agent: [
    'get_project_status',
    'get_task',
    'get_execution_status',
    'get_project_memory',
    'get_task_memory',
    'get_relevant_decisions',
    'get_latest_checkpoint',
    'get_task_handoff',
    'get_task_review',
  ],
  worker: [
    'get_task',
    'get_project_status',
    'get_task_memory',
    'get_latest_checkpoint',
    'get_task_review',
  ],
  'scrum-master': [
    'get_project_status',
    'get_task',
    'get_agent_workload',
    'find_bench_agents',
    'propose_task_split',
    'assign_task',
    'get_project_delivery_state',
    'get_task_review',
    'submit_review',
  ],
  'business-analyst': [
    'get_project_status',
    'get_task',
  ],
};

export function validateToolActor(tool: AgentToolDefinition, context: AgentToolContext): void {
  if (!tool.allowedActors.includes(context.actorType)) {
    const err = new Error(`Actor "${context.actorType}" is not allowed to use tool "${tool.name}"`);
    (err as Error & { code?: string }).code = 'ACTOR_NOT_ALLOWED';
    throw err;
  }
}

export function validateToolPermission(tool: AgentToolDefinition, context: AgentToolContext): void {
  const allowed = resolveAllowedTools(context);
  if (!allowed.includes(tool.name)) {
    const err = new Error(`Permission denied: tool "${tool.name}" is not available to "${context.actorType}"`);
    (err as Error & { code?: string }).code = 'PERMISSION_DENIED';
    throw err;
  }
}

export function resolveAllowedTools(context: AgentToolContext): string[] {
  const personaKey = (context.persona || 'project-control') as 'project-control' | 'scrum-master' | 'business-analyst';
  const personaAllow: Record<typeof personaKey, string[]> = {
    'project-control': [
      'get_organization_status',
      'get_project_status',
      'get_task',
      'get_agent_workload',
      'find_bench_agents',
      'propose_project_bootstrap',
      'apply_project_bootstrap',
      'propose_task',
      'apply_task',
      'propose_capacity_change',
      'apply_capacity_change',
      'propose_task_split',
      'apply_task_split',
      'assign_task',
      'propose_execution',
      'get_execution_status',
      'get_project_memory',
      'get_task_memory',
      'get_relevant_decisions',
      'get_latest_checkpoint',
      'get_task_handoff',
      'get_project_delivery_state',
      'pause_task',
      'propose_resume_task',
      'propose_task_reassignment',
      'get_task_review',
      'submit_review',
      'submit_qa_result',
    ],
    'scrum-master': [
      'get_project_status',
      'get_task',
      'get_agent_workload',
      'find_bench_agents',
      'propose_capacity_change',
      'apply_capacity_change',
      'propose_task_split',
      'apply_task_split',
      'assign_task',
      'get_execution_status',
      'get_project_delivery_state',
      'get_task_review',
      'submit_review',
    ],
    'business-analyst': [
      'get_project_status',
      'get_task',
      'propose_task',
      'apply_task',
    ],
  };
  if (context.actorType === 'project-control') {
    return personaAllow[personaKey] || personaAllow['project-control'];
  }
  return DEFAULT_TOOL_ACCESS[context.actorType] || [];
}

export function toolRequiresApproval(tool: AgentToolDefinition): boolean {
  return tool.approvalMode === 'proposal' || tool.approvalMode === 'explicit';
}
