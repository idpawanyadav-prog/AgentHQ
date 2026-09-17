-- SQLite does not support CREATE TYPE; use CHECK constraints for enum validation.
-- ProjectMemory
CREATE TABLE "ProjectMemory" (
    id TEXT NOT NULL PRIMARY KEY,
    projectId TEXT NOT NULL UNIQUE,
    mission TEXT,
    productSummary TEXT,
    architecture TEXT,
    techStack TEXT,
    conventions TEXT,
    currentPhase TEXT CHECK(currentPhase IN ('discovery','planning','building','reviewing','testing','releasing','blocked','completed')),
    currentGoal TEXT,
    completedWork TEXT,
    keyDecisions TEXT,
    knownRisks TEXT,
    blockers TEXT,
    nextActions TEXT,
    openQuestions TEXT,
    testStrategy TEXT,
    releaseNotes TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "ProjectMemory_projectId_idx" ON "ProjectMemory"("projectId");

-- TaskMemory
CREATE TABLE "TaskMemory" (
    id TEXT NOT NULL PRIMARY KEY,
    taskId TEXT NOT NULL UNIQUE,
    projectId TEXT NOT NULL,
    objective TEXT,
    context TEXT,
    investigation TEXT,
    implementation TEXT,
    filesTouched TEXT,
    commandsRun TEXT,
    validation TEXT,
    decisions TEXT,
    blockers TEXT,
    remainingWork TEXT,
    nextAction TEXT,
    lastAgentId TEXT,
    lastExecutionId TEXT,
    version INTEGER NOT NULL DEFAULT 1,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "TaskMemory_projectId_idx" ON "TaskMemory"("projectId");
CREATE INDEX "TaskMemory_lastAgentId_idx" ON "TaskMemory"("lastAgentId");

-- AgentMemory
CREATE TABLE "AgentMemory" (
    id TEXT NOT NULL PRIMARY KEY,
    agentId TEXT NOT NULL,
    projectId TEXT,
    scope TEXT NOT NULL DEFAULT 'project' CHECK(scope IN ('global','project','task')),
    category TEXT NOT NULL CHECK(category IN ('technical_pattern','lesson','failure','workflow','domain_knowledge','preference')),
    title TEXT,
    content TEXT NOT NULL,
    importance INTEGER NOT NULL DEFAULT 50,
    confidence REAL,
    sourceType TEXT,
    sourceId TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastUsedAt" TEXT
);

CREATE INDEX "AgentMemory_agentId_idx" ON "AgentMemory"("agentId");
CREATE INDEX "AgentMemory_projectId_idx" ON "AgentMemory"("projectId");
CREATE INDEX "AgentMemory_scope_idx" ON "AgentMemory"("scope");
CREATE INDEX "AgentMemory_category_idx" ON "AgentMemory"("category");

-- DecisionRecord
CREATE TABLE "DecisionRecord" (
    id TEXT NOT NULL PRIMARY KEY,
    projectId TEXT NOT NULL,
    taskId TEXT,
    sprintId TEXT,
    title TEXT NOT NULL,
    decision TEXT NOT NULL,
    rationale TEXT,
    alternatives TEXT,
    consequences TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','superseded')),
    createdByAgentId TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supersededAt" TEXT
);

CREATE INDEX "DecisionRecord_projectId_idx" ON "DecisionRecord"("projectId");
CREATE INDEX "DecisionRecord_taskId_idx" ON "DecisionRecord"("taskId");
CREATE INDEX "DecisionRecord_status_idx" ON "DecisionRecord"("status");

-- HandoffRecord
CREATE TABLE "HandoffRecord" (
    id TEXT NOT NULL PRIMARY KEY,
    projectId TEXT NOT NULL,
    taskId TEXT,
    fromAgentId TEXT,
    toAgentId TEXT,
    type TEXT NOT NULL CHECK(type IN ('developer_to_reviewer','reviewer_to_developer','developer_to_qa','qa_to_developer','agent_reassignment','task_pause','task_resume','sprint_handoff')),
    summary TEXT NOT NULL,
    completedWork TEXT,
    remainingWork TEXT,
    importantFiles TEXT,
    decisions TEXT,
    blockers TEXT,
    nextActions TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "consumedAt" TEXT
);

CREATE INDEX "HandoffRecord_projectId_idx" ON "HandoffRecord"("projectId");
CREATE INDEX "HandoffRecord_taskId_idx" ON "HandoffRecord"("taskId");
CREATE INDEX "HandoffRecord_toAgentId_idx" ON "HandoffRecord"("toAgentId");

-- TaskReview
CREATE TABLE "TaskReview" (
    id TEXT NOT NULL PRIMARY KEY,
    projectId TEXT NOT NULL,
    taskId TEXT NOT NULL UNIQUE,
    executionRunId TEXT,
    reviewerAgentId TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','approved','changes_requested')),
    summary TEXT,
    findings TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TEXT
);

CREATE INDEX "TaskReview_taskId_idx" ON "TaskReview"("taskId");
CREATE INDEX "TaskReview_status_idx" ON "TaskReview"("status");

-- SprintSummary
CREATE TABLE "SprintSummary" (
    id TEXT NOT NULL PRIMARY KEY,
    sprintId TEXT NOT NULL UNIQUE,
    projectId TEXT NOT NULL,
    goal TEXT,
    completed TEXT,
    incomplete TEXT,
    blockers TEXT,
    decisions TEXT,
    lessons TEXT,
    nextSprint TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SprintSummary_projectId_idx" ON "SprintSummary"("projectId");

-- SprintRetrospective
CREATE TABLE "SprintRetrospective" (
    id TEXT NOT NULL PRIMARY KEY,
    sprintId TEXT NOT NULL,
    projectId TEXT NOT NULL,
    wentWell TEXT,
    problems TEXT,
    lessons TEXT,
    actions TEXT,
    "createdAt" TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX "SprintRetrospective_sprintId_idx" ON "SprintRetrospective"("sprintId");
CREATE INDEX "SprintRetrospective_projectId_idx" ON "SprintRetrospective"("projectId");
