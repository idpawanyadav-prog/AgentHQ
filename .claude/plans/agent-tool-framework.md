# AgentHQ Native AI Tool Framework — Implementation Plan

## Architecture Decision

**Separate registries, shared provider infrastructure.**

- `lib/execution/tools/registry.ts` — existing API coding tools (file/run/git)
- `lib/agent-tools/` — new management tool framework (Project/Task/Staffing/Execution)

Reason: Coding tools are scoped to a workspace. Management tools operate on Prisma state. Mixing them creates permission confusion. Both use the same `NormalizedToolCall` type and provider adapters.

---

## Batch 1 — Tool Framework Core

Create the foundation that all tools plug into.

### Files to create

| File | Purpose |
|------|---------|
| `lib/agent-tools/types.ts` | `AgentToolDefinition`, `AgentToolContext`, `AgentToolResult`, `NormalizedToolCall`, `NormalizedToolResult` |
| `lib/agent-tools/registry.ts` | `registerAgentTool`, `getAgentTool`, `listAgentTools` |
| `lib/agent-tools/runtime.ts` | `executeAgentToolCall` — the main entry point for all tool execution |
| `lib/agent-tools/permissions.ts` | `validateToolActor`, `validateToolPermission` — actor + RoleGroup checks |
| `lib/agent-tools/validation.ts` | `validateToolArguments` — JSON Schema validation |
| `lib/agent-tools/provider-tools.ts` | `getToolsForContext`, `toOpenAITools`, `toAnthropicTools` |

### Registration

Create `lib/agent-tools/index.ts` that imports and registers all 15 tools.

### Tests

| Test file | What it verifies |
|-----------|-----------------|
| `tests/agent-tools-registry.test.ts` | Register, get, duplicate rejection, listing |
| `tests/agent-tools-permissions.test.ts` | Actor checks, RoleGroup access, persona defaults |
| `tests/agent-tools-validation.test.ts` | Bad args fail, valid args pass |

---

## Batch 2 — Read-Only Tools (5 tools)

Thin handlers that delegate to existing services.

| Tool file | Service it calls | Reuses |
|-----------|-----------------|--------|
| `tools/get-organization-status.ts` | `prisma.project.findMany`, `prisma.team.findMany`, bench query | existing Prisma queries |
| `tools/get-project-status.ts` | `getProjectControlStatus()` | **direct reuse** of `lib/project-control.ts:106` |
| `tools/get-task.ts` | `prisma.task.findUnique` | existing pattern |
| `tools/get-agent-workload.ts` | `prisma.agent.findUnique` with task count | existing pattern |
| `tools/find-bench-agents.ts` | bench query + skill matching | new bench-matcher logic |

---

## Batch 3 — Project Bootstrap Tools (2 tools)

| File | Purpose |
|------|---------|
| `lib/project-control/control-proposals.ts` | New model: `ControlProposal` type + Prisma persistence (uses `ExecutionProposal` schema pattern) |
| `tools/propose-project-bootstrap.ts` | Generates plan, queries bench, persists `ControlProposal` |
| `tools/apply-project-bootstrap.ts` | Reads proposal, creates Team/Project/Sprint/Tasks/Agents |

Services extracted from existing `project-control.ts` logic:
- Role inference (`inferRoles`)
- RoleGroup matching (`chooseRoleGroup`)
- Bench lookup

---

## Batch 4 — Task Tools (4 tools)

| File | Purpose |
|------|---------|
| `lib/project-control/task-actions.ts` | `proposeTaskCreation`, `applyTaskCreation` — extracted from inline logic |
| `tools/propose-task.ts` | Thin wrapper → `proposeTaskCreation` |
| `tools/apply-task.ts` | Thin wrapper → `applyTaskCreation` |
| `tools/propose-task-split.ts` | Splits task into subtasks, persists proposal |
| `tools/assign-task.ts` | Assigns task to agent, validates capacity |

---

## Batch 5 — Staffing Tools (2 tools)

| File | Purpose |
|------|---------|
| `tools/propose-capacity-change.ts` | Reuses/extends `proposeStaffing` from `project-control.ts` |
| `tools/apply-capacity-change.ts` | Reuses `applyStaffing` from `project-control.ts` |

Note: `proposeStaffing` and `applyStaffing` already exist in `lib/project-control.ts`. The tools are thin wrappers that convert tool arguments → service calls.

---

## Batch 6 — Execution Tools (2 tools)

| File | Purpose |
|------|---------|
| `tools/propose-execution.ts` | Reuses `proposeExecution` from `lib/execution/execution-service.ts` |
| `tools/get-execution-status.ts` | Reads `ExecutionRun` by ID |

These are the thinnest tools — the heavy lifting already exists.

---

## Batch 7 — Project Control Chat Integration

Modify `pages/api/project-control/chat.ts`:
1. Load context + resolve configured model
2. Get allowed management tools via `getToolsForContext`
3. Convert to provider format via `toOpenAITools`/`toAnthropicTools`
4. Multi-turn loop (max 12 turns): call model → execute tool calls → feed results back
5. Return final reply + proposal references + tool call summary

### Files modified
- `pages/api/project-control/chat.ts` — full rewrite to support tool loop

---

## Batch 8 — Tests

| Test file | What it verifies |
|-----------|-----------------|
| `tests/agent-tools-registry.test.ts` | Register, get, duplicate rejection, listing |
| `tests/agent-tools-permissions.test.ts` | Actor checks, RoleGroup access, persona defaults |
| `tests/agent-tools-validation.test.ts` | Bad args fail before handler runs |
| `tests/agent-tools-openai-schema.test.ts` | Correct OpenAI format conversion |
| `tests/agent-tools-anthropic-schema.test.ts` | Correct Anthropic format conversion |
| `tests/agent-tools-runtime.test.ts` | Full execute flow: tool lookup → validation → execution → result |
| `tests/agent-tools-multi-turn.test.ts` | Mock provider: tool call → result → final reply |
| `tests/propose-project-bootstrap.test.ts` | Proposal persisted, bench searched, hires calculated |
| `tests/propose-capacity-change.test.ts` | Bench match vs. hire fallback |
| `tests/propose-task.test.ts` | Proposal persisted, no real task created |

---

## Execution Order

```
Batch 1 (framework) → Batch 2 (read tools) → Batch 3 (bootstrap)
     ↓                      ↓                       ↓
Tests pass              Tests pass             Tests pass
     ↓                      ↓                       ↓
Batch 4 (tasks)    →    Batch 5 (staffing)  →  Batch 6 (execution)
     ↓                      ↓                       ↓
Tests pass              Tests pass             Tests pass
     ↓
Batch 7 (chat integration)
     ↓
Tests pass
     ↓
Batch 8 (remaining tests)
```

Each batch: implement → add tests → run typecheck → run lint → run tests → fix failures.

---

## Key Reuse Points

| Existing code | Reused by |
|--------------|-----------|
| `getProjectControlStatus()` | `get-project-status` tool |
| `proposeStaffing()` / `applyStaffing()` | `propose_capacity_change` / `apply_capacity_change` tools |
| `proposeExecution()` / `approveExecutionProposal()` | `propose_execution` tool |
| Provider adapters (`anthropic-tools.ts`, `openai-tools.ts`) | `provider-tools.ts` conversion |
| `NormalizedToolCall` type from `providers/types.ts` | Shared type, no duplication |
| `logActivity()` | All tools that need activity logging |
| `readConfiguredModels()` | Multiple tools for model resolution |
