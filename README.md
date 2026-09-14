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
- **Express API** on http://localhost:4000

### 4. Open in browser
```
http://localhost:3000
```

## Architecture

This project uses a two-process development architecture:

- **Next.js** (port 3000) — Frontend, pages, API routes
- **Express** (port 4000) — REST API, Socket.IO realtime, AI agent execution

Both processes share the same SQLite database via Prisma.

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
npm run start # Start production server (Next.js)
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
GATEWAY_ENCRYPTION_KEY=<your_32_char_key>
```

### Gateway Encryption

In production, set `GATEWAY_ENCRYPTION_KEY` to a secure random string (minimum 32 characters). This encrypts AI provider API keys stored in the database. In development (`NODE_ENV=development`), keys are base64-encoded if no encryption key is set.

## Tech Stack

- Next.js 14 + React 18
- Express.js + Socket.IO
- Prisma + SQLite (dev) / PostgreSQL (production)
- Tailwind CSS
- @dnd-kit (Kanban drag-and-drop)
