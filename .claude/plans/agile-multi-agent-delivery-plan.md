# AgentHQ — Agile Multi-Agent Delivery & Durable Memory
## Implementation Plan

## Current State Assessment

### What exists
- Prisma schema: Team, Member, Agent, Project, Sprint, Task, Activity, ExecutionRun, ExecutionProposal, ExecutionCheckpoint, Workspace, DynamicSquad, ProjectExecutionState, Job, Gateway, RoleGroup, Skill, AgentRoleAssignment, ProjectGovernance, ProjectIssue
- Agent-tools framework: 16 tools registered, runtime/registry/permissions/validation working
- Execution engine: propose → approve → enqueue → run pipeline functional
- Workspace service: git clone, worktree preparation, diff/commit operations
- Agent runner: provider API calls, budget guards, concurrency limits
- Project control: status aggregation, staffing proposals,  generation
- 35 existing tests, prisma mock, test infrastructure

### What's missing (all required by requirements)
1. Prisma models: ProjectMemory, TaskMemory, AgentMemory, DecisionRecord, HandoffRecord, TaskReview, SprintSummary, SprintRetrospective
2. Memory services: MemoryService, MemoryRetrievalService, memory-promotion
3. Orchestration: project-orchestrator, assignment-planner, task-dependencies, sprint-planner, stalled-work, delivery-state
4. Review/QA: TaskReview workflow, repair loop
5. Pause/Resume: checkpoint service, recovery service, handoff service
6. APIs: orchestrate, pause/resume/reassign, memory endpoints, agent-office/context
7. Agent tools: memory read tools, pause/resume/reassign tools
8. Tests: ~20 new test files covering all new behavior

## Implementation Phases

### Phase 0 — Stabilize (pre-requisite)
- Verify current tests pass, typecheck clean

### Phase 1 — Memory Foundation
**Files:**
- `prisma/migrations/20260917000001_add_memory_models/migration.sql` — new models
- Updated `prisma/schema.prisma` — ProjectMemory, TaskMemory, AgentMemory, DecisionRecord, HandoffRecord, TaskReview, SprintSummary, SprintRetrospective
- `lib/memory/memory-service.ts` — write operations for all memory types
- `lib/memory/memory-retrieval.ts` — buildExecutionMemoryContext
- `lib/memory/memory-promotion.ts` — classify and route events to correct memory
- `lib/memory/project-memory.ts` — ProjectMemory CRUD
- `lib/memory/task-memory.ts` — TaskMemory CRUD
- `lib/memory/agent-memory.ts` — AgentMemory CRUD
- `lib/memory/decision-service.ts` — DecisionRecord CRUD
- `lib/memory/handoff-service.ts` — HandoffRecord CRUD

### Phase 2 — Pause/Resume & Recovery
**Files:**
- `lib/orchestration/task-dependencies.ts` — dependency resolution, cycle detection, ready-task calculation
- `lib/orchestration/assignment-planner.ts` — scoring-based agent matching
- `lib/orchestration/recovery-service.ts` — recoverInterruptedExecutions, resumeTask
- `lib/orchestration/project-orchestrator.ts` — main orchestration cycle
- `lib/orchestration/stalled-work.ts` — detect stalled work
- `lib/orchestration/delivery-state.ts` — compute ProjectDeliveryState
- `lib/orchestration/checkpoint-service.ts` — extended checkpoint phases

### Phase 3 — APIs
**Files:**
- `pages/api/projects/[id]/orchestrate.ts`
- `pages/api/tasks/[id]/pause.ts`, `pages/api/tasks/[id]/resume.ts`, `pages/api/tasks/[id]/reassign.ts`
- `pages/api/projects/[id]/delivery-state.ts`
- `pages/api/projects/[id]/memory.ts`
- `pages/api/tasks/[id]/memory.ts`
- `pages/api/agents/[id]/memory.ts`
- `pages/api/projects/[id]/decisions.ts`
- `pages/api/tasks/[id]/checkpoints.ts`
- `pages/api/tasks/[id]/handoffs.ts`
- `pages/api/agent-office/context.ts`
- `pages/api/sprints/[id]/plan.ts`, `start.ts`, `complete.ts`

### Phase 4 — Review/QA
**Files:**
- `lib/review/review-service.ts`
- `lib/review/qa-service.ts`
- Updated `lib/execution/execution-service.ts` — integrate review/QA into execution lifecycle

### Phase 5 — Agent Tool Integration
**Files:**
- `lib/agent-tools/tools/get-project-memory.ts`
- `lib/agent-tools/tools/get-task-memory.ts`
- `lib/agent-tools/tools/get-decisions.ts`
- `lib/agent-tools/tools/get-checkpoint.ts`
- `lib/agent-tools/tools/get-handoff.ts`
- `lib/agent-tools/tools/get-delivery-state.ts`
- `lib/agent-tools/tools/pause-task.ts`
- `lib/agent-tools/tools/propose-resume-task.ts`
- `lib/agent-tools/tools/propose-reassign.ts`
- Updated `lib/agent-tools/management-tools.ts` — register new tools

### Phase 6 — Tests (parallel with implementation)
**Files:**
- `tests/project-memory.test.ts`
- `tests/task-memory.test.ts`
- `tests/memory-retrieval.test.ts`
- `tests/execution-checkpoint.test.ts`
- `tests/task-pause-resume.test.ts`
- `tests/task-reassignment-memory.test.ts`
- `tests/project-restart-recovery.test.ts`
- `tests/task-dependencies.test.ts`
- `tests/assignment-planner.test.ts`
- `tests/project-orchestrator.test.ts`
- `tests/review-workflow.test.ts`
- `tests/qa-workflow.test.ts`
- `tests/agent-office-context.test.ts`
- `tests/sprint-lifecycle.test.ts`

## Strategy
- Split into 2-3 parallel agent teams: (1) schema + memory services, (2) orchestration + recovery, (3) APIs + agent tools + tests
- Each agent owns distinct files, no conflicts
- Tests written alongside implementation
- Memory semantics follow: Project=shared, Task=durable, Agent=personal

## Files to modify
- `prisma/schema.prisma` — add 8 new models
- `lib/project-control.ts` — integrate with memory retrieval
- `lib/execution/execution-service.ts` — add review/QA hooks, pause/resume
- `lib/agent-tools/management-tools.ts` — register new tools
- `lib/agent-context.ts` — include memory in agent prompts
