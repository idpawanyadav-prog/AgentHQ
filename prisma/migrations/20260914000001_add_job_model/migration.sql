-- CreateTable
CREATE TABLE "Job" (
 "id" TEXT NOT NULL PRIMARY KEY,
 "kind" TEXT NOT NULL DEFAULT 'agent_run',
 "status" TEXT NOT NULL DEFAULT 'queued',
 "agentId" TEXT NOT NULL,
 "taskId" TEXT,
 "teamId" TEXT NOT NULL,
 "payload" TEXT NOT NULL DEFAULT '{}',
 "result" TEXT,
 "error" TEXT,
 "attempts" INTEGER NOT NULL DEFAULT 0,
 "maxAttempts" INTEGER NOT NULL DEFAULT 3,
 "startedAt" DATETIME,
 "finishedAt" DATETIME,
 "heartbeatAt" DATETIME,
 "cancelled" INTEGER NOT NULL DEFAULT 0,
 "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
 "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "Job_status_createdAt_idx" ON "Job"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Job_agentId_idx" ON "Job"("agentId");

-- CreateIndex
CREATE INDEX "Job_taskId_idx" ON "Job"("taskId");
