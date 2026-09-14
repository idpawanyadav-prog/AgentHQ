# Agent Office Dashboard — Project Instructions

## Superpowers Development Methodology

This project uses [Superpowers](https://github.com/obra/superpowers) for disciplined, systematic development. The Superpowers skills are installed at `.superpowers/` and are activated automatically.

### Active Skills

Before any development task, check `.superpowers/skills/` for relevant skills:

| When | Skill | Purpose |
|------|-------|---------|
| Before writing code | `brainstorming` | Clarify requirements and refine ideas |
| Before implementing | `writing-plans` | Break work into exact tasks with verification steps |
| Any bug/failure | `systematic-debugging` | Find root cause before fixing |
| New feature or bugfix | `test-driven-development` | Write failing test first (RED-GREEN-REFACTOR) |
| Before claiming done | `verification-before-completion` | Prove completion with evidence |
| Parallel work | `dispatching-parallel-agents` | Coordinate multiple developers |
| PR/merge | `requesting-code-review` / `finishing-a-development-branch` | Review and merge safely |

### Core Principles

1. **Root cause before fix** — Never fix a symptom. Find the source first.
2. **Test-first development** — No production code without a failing test first.
3. **Evidence over claims** — Verify everything before declaring success.
4. **Systematic over ad-hoc** — Plans before code, debugging over guessing.

## Team Structure

Role | Responsibility
-----|---------------
**Product Owner (You)** | Requirements, features, bug reports
**Team Lead / Architect (Me)** | Design, task breakdown, team coordination, integration, review
**Backend Developer** | APIs, business logic, database, auth
**Frontend Developer** | UI, components, forms, navigation
**QA Engineer** | Test requirements, identify bugs, verify fixes
**Code Reviewer** | Review quality, security, performance, maintainability

## Task Distribution

1. Analyze requirements and codebase
2. Decide if parallel work benefits the task
3. Create implementation plan with acceptance criteria
4. Spawn specialist agents when tasks are independent
5. Each developer owns specific files/modules
6. Wait for all developers to finish
7. QA tests the implementation
8. Code Reviewer inspects changes
9. Fix issues found
10. Integrate and report

## Tech Stack

- **Frontend**: Next.js 14, React, TypeScript
- **Styling**: Tailwind CSS
- **Icons**: react-icons/fa
- **Dev Server**: http://localhost:3000

## Completion Report

Always provide:
- Summary of changes
- Tasks assigned to each developer
- Files created or modified
- Tests executed and results
- Issues remaining
- Decisions requiring approval
