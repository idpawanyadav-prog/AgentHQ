-- Alter Project with repository metadata
ALTER TABLE "Project" ADD COLUMN "repositoryProvider" TEXT;
ALTER TABLE "Project" ADD COLUMN "repositoryMode" TEXT DEFAULT 'none';
ALTER TABLE "Project" ADD COLUMN "repositoryStatus" TEXT DEFAULT 'unconfigured';
ALTER TABLE "Project" ADD COLUMN "defaultBranch" TEXT DEFAULT 'main';

-- Alter RoleGroup with tool policy JSON
ALTER TABLE "RoleGroup" ADD COLUMN "toolPolicy" TEXT;

-- CreateTable
CREATE TABLE "Workspace" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "executionRunId" TEXT,
    "path" TEXT NOT NULL,
    "branch" TEXT,
    "baseCommit" TEXT,
    "headCommit" TEXT,
    "status" TEXT NOT NULL DEFAULT 'creating',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Workspace_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Workspace_executionRunId_fkey" FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "agentId" TEXT,
    "squadId" TEXT,
    "jobId" TEXT,
    "workspaceId" TEXT,
    "engine" TEXT NOT NULL,
    "configuredModelId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'queued',
    "outcome" TEXT,
    "failureReason" TEXT,
    "startedAt" DATETIME,
    "finishedAt" DATETIME,
    "heartbeatAt" DATETIME,
    "exitCode" INTEGER,
    "timedOut" BOOLEAN NOT NULL DEFAULT false,
    "inputTokens" INTEGER,
    "outputTokens" INTEGER,
    "totalTokens" INTEGER,
    "costUsd" REAL,
    "resultSummary" TEXT,
    "changedFiles" TEXT,
    "artifacts" TEXT,
    "commands" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ExecutionRun_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ExecutionCheckpoint" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "executionRunId" TEXT NOT NULL,
    "phase" TEXT NOT NULL,
    "gitCommit" TEXT,
    "taskStatus" TEXT,
    "agentStatus" TEXT,
    "metadata" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ExecutionCheckpoint_executionRunId_fkey" FOREIGN KEY ("executionRunId") REFERENCES "ExecutionRun" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "DynamicSquad" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "taskId" TEXT,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" DATETIME,
    CONSTRAINT "DynamicSquad_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SquadMember" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "squadId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    CONSTRAINT "SquadMember_squadId_fkey" FOREIGN KEY ("squadId") REFERENCES "DynamicSquad" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectGovernance" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "humanDirectives" TEXT,
    "forbiddenActions" TEXT,
    "architectureRules" TEXT,
    "approvalRules" TEXT,
    "maxDailyTokens" INTEGER,
    "maxDailyCostUsd" REAL,
    "maxConcurrentRuns" INTEGER,
    "allowShell" BOOLEAN NOT NULL DEFAULT false,
    "allowRemotePush" BOOLEAN NOT NULL DEFAULT false,
    "allowAutoPr" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProjectGovernance_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectIssue" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "severity" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" TEXT NOT NULL DEFAULT 'open',
    "source" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" DATETIME,
    CONSTRAINT "ProjectIssue_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProjectExecutionState" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "projectId" TEXT NOT NULL,
    "phase" TEXT NOT NULL DEFAULT 'planning',
    "status" TEXT NOT NULL DEFAULT 'active',
    "lastRunId" TEXT,
    "summary" TEXT,
    "updatedAt" DATETIME NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "ProjectExecutionState_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "Project" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "Workspace_projectId_idx" ON "Workspace"("projectId");
CREATE INDEX "Workspace_executionRunId_idx" ON "Workspace"("executionRunId");
CREATE INDEX "Workspace_status_idx" ON "Workspace"("status");
CREATE INDEX "ExecutionRun_projectId_idx" ON "ExecutionRun"("projectId");
CREATE INDEX "ExecutionRun_taskId_idx" ON "ExecutionRun"("taskId");
CREATE INDEX "ExecutionRun_agentId_idx" ON "ExecutionRun"("agentId");
CREATE INDEX "ExecutionRun_squadId_idx" ON "ExecutionRun"("squadId");
CREATE INDEX "ExecutionRun_status_idx" ON "ExecutionRun"("status");
CREATE INDEX "ExecutionRun_createdAt_idx" ON "ExecutionRun"("createdAt");
CREATE INDEX "ExecutionCheckpoint_executionRunId_idx" ON "ExecutionCheckpoint"("executionRunId");
CREATE INDEX "ExecutionCheckpoint_phase_idx" ON "ExecutionCheckpoint"("phase");
CREATE INDEX "DynamicSquad_projectId_idx" ON "DynamicSquad"("projectId");
CREATE INDEX "DynamicSquad_taskId_idx" ON "DynamicSquad"("taskId");
CREATE INDEX "DynamicSquad_status_idx" ON "DynamicSquad"("status");
CREATE INDEX "SquadMember_squadId_idx" ON "SquadMember"("squadId");
CREATE INDEX "SquadMember_agentId_idx" ON "SquadMember"("agentId");
CREATE UNIQUE INDEX "ProjectGovernance_projectId_key" ON "ProjectGovernance"("projectId");
CREATE INDEX "ProjectIssue_projectId_idx" ON "ProjectIssue"("projectId");
CREATE INDEX "ProjectIssue_severity_idx" ON "ProjectIssue"("severity");
CREATE INDEX "ProjectIssue_status_idx" ON "ProjectIssue"("status");
CREATE UNIQUE INDEX "ProjectExecutionState_projectId_key" ON "ProjectExecutionState"("projectId");
