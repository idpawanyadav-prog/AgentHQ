-- Keep the newest assignment per Agent before enforcing one active role group.
DELETE FROM "AgentRoleAssignment"
WHERE "id" NOT IN (
    SELECT "id"
    FROM (
        SELECT
            "id",
            ROW_NUMBER() OVER (
                PARTITION BY "agentId"
                ORDER BY "updatedAt" DESC, "createdAt" DESC, "id" DESC
            ) AS "rank"
        FROM "AgentRoleAssignment"
    )
    WHERE "rank" = 1
);

-- CreateIndex
CREATE UNIQUE INDEX "AgentRoleAssignment_agentId_key" ON "AgentRoleAssignment"("agentId");
