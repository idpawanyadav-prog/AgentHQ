import prisma from '../../prisma';
import { writeTaskReview } from '../../memory/memory-service';
import { recordProposal } from '../../proposal-store';
import type { AgentToolDefinition, AgentToolContext, AgentToolResult } from '../../agent-tools/types';

export const submitQaResultTool: AgentToolDefinition = {
  name: 'submit_qa_result',
  description: 'Submit a QA result for a task: passed or failed.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      projectId: { type: 'string' },
      executionRunId: { type: 'string' },
      status: { type: 'string', enum: ['passed', 'failed'] },
      findings: { type: 'string' },
    },
    required: ['taskId', 'projectId', 'executionRunId', 'status'],
  },
  risk: 'medium',
  approvalMode: 'proposal',
  allowedActors: ['project-control'],
  async execute(args) {
    const taskId = String(args.taskId);
    const projectId = String(args.projectId);
    const executionRunId = String(args.executionRunId);
    const qaStatus = String(args.status);
    const findings = typeof args.findings === 'string' ? args.findings : undefined;

    const validStatuses = ['passed', 'failed'];
    if (!validStatuses.includes(qaStatus)) {
      return { ok: false, error: { code: 'INVALID_STATUS', message: `Invalid QA status: ${qaStatus}. Must be one of: ${validStatuses.join(', ')}.` } };
    }

    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
    if (!task) {
      return { ok: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` } };
    }

    const proposalId = `proposal_qa_${Date.now()}`;
    recordProposal({
      id: proposalId,
      toolName: 'submit_qa_result',
      arguments: args,
      context: { actorType: 'project-control' },
      result: {
        toolCallId: '',
        toolName: 'submit_qa_result',
        ok: true,
        data: { taskId, projectId, executionRunId, status: qaStatus, findings },
      },
      createdAt: new Date(),
      ttlMs: 24 * 60 * 60 * 1000,
    });

    return {
      ok: true,
      data: { taskId, projectId, executionRunId, status: qaStatus, proposalId },
      message: `QA result for task "${task.title}" proposed: ${qaStatus}.`,
    };
  },
};
