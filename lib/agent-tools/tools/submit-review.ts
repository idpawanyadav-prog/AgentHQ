import prisma from '../../prisma';
import { writeTaskReview } from '../../memory/memory-service';
import { recordProposal } from '../../proposal-store';
import type { AgentToolDefinition, AgentToolContext, AgentToolResult } from '../../agent-tools/types';

export const submitReviewTool: AgentToolDefinition = {
  name: 'submit_review',
  description: 'Submit a review for a task: approve or request changes.',
  inputSchema: {
    type: 'object',
    properties: {
      taskId: { type: 'string' },
      executionRunId: { type: 'string' },
      status: { type: 'string', enum: ['approved', 'changes_requested'] },
      summary: { type: 'string' },
      findings: { type: 'string' },
    },
    required: ['taskId', 'executionRunId', 'status'],
  },
  risk: 'medium',
  approvalMode: 'proposal',
  allowedActors: ['project-control'],
  async execute(args) {
    const taskId = String(args.taskId);
    const executionRunId = String(args.executionRunId);
    const reviewStatus = String(args.status);
    const summary = typeof args.summary === 'string' ? args.summary : undefined;
    const findings = typeof args.findings === 'string' ? args.findings : undefined;

    const validStatuses = ['approved', 'changes_requested'];
    if (!validStatuses.includes(reviewStatus)) {
      return { ok: false, error: { code: 'INVALID_STATUS', message: `Invalid review status: ${reviewStatus}. Must be one of: ${validStatuses.join(', ')}.` } };
    }

    const task = await prisma.task.findUnique({ where: { id: taskId }, include: { project: true } });
    if (!task) {
      return { ok: false, error: { code: 'TASK_NOT_FOUND', message: `Task ${taskId} not found.` } };
    }

    const proposalId = `proposal_review_${Date.now()}`;
    recordProposal({
      id: proposalId,
      toolName: 'submit_review',
      arguments: args,
      context: { actorType: 'project-control' },
      result: {
        toolCallId: '',
        toolName: 'submit_review',
        ok: true,
        data: { taskId, executionRunId, status: reviewStatus, summary, findings },
      },
      createdAt: new Date(),
      ttlMs: 24 * 60 * 60 * 1000,
    });

    return {
      ok: true,
      data: { taskId, executionRunId, status: reviewStatus, proposalId },
      message: `Review for task "${task.title}" proposed: ${reviewStatus}.`,
    };
  },
};
