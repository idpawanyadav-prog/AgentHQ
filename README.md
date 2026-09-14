# Agent Office Dashboard

A real-time dashboard to manage teams, tasks, and AI agents from one screen.

## Quick Start

### 1. Install dependencies
```bash
npm install
```

### 2. Set up the database
```bash
npx prisma generate
npx prisma db push
npx prisma db seed
```

### 3. Start the app
```bash
npm run dev
```

This starts:
- **Next.js** on http://localhost:3000
- **Express realtime/Socket.IO service** on http://localhost:4000
- **Durable worker** for agent jobs

### 4. Open in browser
```
http://localhost:3000
```

## Architecture

This project uses a three-process runtime architecture:

- **Next.js** (port 3000) — Frontend, pages, and core API routes
- **Express** (port 4000) — Realtime readiness, API proxying, GitHub/AI integration routes, and Socket.IO
- **Durable worker** — Polls persisted jobs and runs AI agent work

All processes share the same SQLite database via Prisma.

## What's Included

- **Database:** SQLite via Prisma ORM
- **Seeded data:** 1 team, 4 members (2 human + 2 AI), 5 tasks, activities
- **API:** http://localhost:4000/api/teams, /tasks, /agents, /activity, /projects
- **Socket.IO:** Real-time activity feed and agent execution events
- **Auth:** Cookie-based session authentication (custom implementation)

## Pages

| URL | Page |
|---|---|
| `/` | Dashboard overview (stat cards, teams, activity feed) |
| `/teams` | Teams list |
| `/teams/[id]` | Team detail + Kanban task board |
| `/agents/[id]` | Agent detail with timeline |
| `/projects/[id]` | Project progress with milestones |
| `/settings` | API keys and model configuration |

## Scripts

```bash
npm run dev # Start both Next.js + Express (development)
npm run dev:next # Start Next.js only
npm run dev:server # Start Express only
npm run build # Build for production
npm run start # Start production services (Next.js + realtime + worker)
npm run db:studio # Open Prisma Studio (visual DB editor)
npm run db:seed # Seed the database with demo data
npm run db:migrate # Run Prisma migrations
npm run test # Run tests
npm run test:coverage # Run tests with coverage
npm run verify # Run typecheck, lint, and tests
```

## Environment

Copy `.env.example` to `.env` and configure:

```env
DATABASE_URL="file:./dev.db"
PORT=4000
JWT_SECRET=<your_secret>
ANTHROPIC_API_KEY=<your_key>
OPENAI_API_KEY=<your_key>
# Required in production. Exactly 64 hex characters (32 bytes).
# Generate with: openssl rand -hex 32
GATEWAY_ENCRYPTION_KEY=
# Required when enabling POST /api/github/webhook.
GITHUB_WEBHOOK_SECRET=<same_secret_configured_in_github>
```

### Gateway Encryption

In production, set `GATEWAY_ENCRYPTION_KEY` to a stable 64-character hexadecimal value. This encrypts AI provider API keys stored in the database, and changing it will make existing encrypted gateway credentials undecryptable. In development, the app uses `.local/gateway.key` when `GATEWAY_ENCRYPTION_KEY` is not set.

### GitHub Webhooks

GitHub dashboard routes require an AgentHQ dashboard session. `POST /api/github/webhook` does not use the dashboard cookie; it verifies `X-Hub-Signature-256` with `GITHUB_WEBHOOK_SECRET` against the raw request body before processing the event.

## Tech Stack

- Next.js 15 + React 18
- Express.js + Socket.IO
- Prisma + SQLite
- Tailwind CSS
- @dnd-kit (Kanban drag-and-drop)
