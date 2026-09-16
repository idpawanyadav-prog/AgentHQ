-- CreateTable
CREATE TABLE "RoleGroup" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "color" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "InstructionFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleGroupId" TEXT NOT NULL,
    "filename" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "InstructionFile_roleGroupId_fkey" FOREIGN KEY ("roleGroupId") REFERENCES "RoleGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AgentRoleAssignment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleGroupId" TEXT NOT NULL,
    "agentId" TEXT NOT NULL,
    "agentName" TEXT NOT NULL,
    "agentStatus" TEXT NOT NULL DEFAULT 'active',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "AgentRoleAssignment_roleGroupId_fkey" FOREIGN KEY ("roleGroupId") REFERENCES "RoleGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Skill" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roleGroupId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "level" TEXT NOT NULL DEFAULT 'intermediate',
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Skill_roleGroupId_fkey" FOREIGN KEY ("roleGroupId") REFERENCES "RoleGroup" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "RoleGroup_name_idx" ON "RoleGroup"("name");

-- CreateIndex
CREATE INDEX "InstructionFile_roleGroupId_idx" ON "InstructionFile"("roleGroupId");

-- CreateIndex
CREATE INDEX "AgentRoleAssignment_roleGroupId_idx" ON "AgentRoleAssignment"("roleGroupId");

-- CreateIndex
CREATE UNIQUE INDEX "AgentRoleAssignment_roleGroupId_agentId_key" ON "AgentRoleAssignment"("roleGroupId", "agentId");

-- CreateIndex
CREATE INDEX "AgentRoleAssignment_agentId_idx" ON "AgentRoleAssignment"("agentId");

-- CreateIndex
CREATE INDEX "Skill_roleGroupId_idx" ON "Skill"("roleGroupId");
