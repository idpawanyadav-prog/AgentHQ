ALTER TABLE "Project" ADD COLUMN "defaultCodingModelId" TEXT;
ALTER TABLE "Project" ADD COLUMN "validationCommands" TEXT;
ALTER TABLE "ExecutionRun" ADD COLUMN "validation" TEXT;
ALTER TABLE "ExecutionRun" ADD COLUMN "commitSha" TEXT;

CREATE TABLE "ExecutionProposal" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "agentId" TEXT,
    "squadId" TEXT,
    "configuredModelId" TEXT,
    "engine" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "prompt" TEXT NOT NULL,
    "branch" TEXT,
    "commands" TEXT,
    "implications" TEXT,
    "blockers" TEXT,
    "warnings" TEXT,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" DATETIME,
    "appliedAt" DATETIME,
    "rejectedAt" DATETIME,
    CONSTRAINT "ExecutionProposal_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE "ExecutionToolEvent" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionRunId" TEXT NOT NULL,
    "turn" INTEGER NOT NULL,
    "toolName" TEXT NOT NULL,
    "arguments" TEXT,
    "resultSummary" TEXT,
    "status" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL,
    "finishedAt" DATETIME,
    CONSTRAINT "ExecutionToolEvent_executionRunId_fkey" FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE INDEX "ExecutionProposal_projectId_idx" ON "ExecutionProposal"("projectId");
CREATE INDEX "ExecutionProposal_status_idx" ON "ExecutionProposal"("status");
CREATE INDEX "ExecutionProposal_createdAt_idx" ON "ExecutionProposal"("createdAt");
CREATE INDEX "ExecutionToolEvent_executionRunId_idx" ON "ExecutionToolEvent"("executionRunId");
CREATE INDEX "ExecutionToolEvent_toolName_idx" ON "ExecutionToolEvent"("toolName");
CREATE INDEX "ExecutionToolEvent_status_idx" ON "ExecutionToolEvent"("status");
