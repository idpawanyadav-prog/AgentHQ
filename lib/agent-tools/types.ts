import type { ProjectControlPersona } from '../project-control';

export type AgentToolRisk = 'read' | 'low' | 'medium' | 'high';

export type AgentToolApprovalMode = 'none' | 'proposal' | 'explicit';

export type ActorType = 'project-control' | 'agent' | 'worker' | 'scrum-master' | 'business-analyst';

export type AgentToolContext = {
  actorType: ActorType;
  userId?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  taskId?: string | null;
  agentId?: string | null;
  executionRunId?: string | null;
  roleGroupId?: string | null;
  persona?: 'project-control' | 'scrum-master' | 'business-analyst';
  requestId?: string;
  now: Date;
};

export type AgentToolResult<T = unknown> = {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  implications?: unknown;
  proposalId?: string;
  metadata?: Record<string, unknown>;
};

export type AgentToolDefinition = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  risk: AgentToolRisk;
  approvalMode: AgentToolApprovalMode;
  allowedActors: ActorType[];
  execute: (args: Record<string, unknown>, context: AgentToolContext) => Promise<AgentToolResult>;
};
