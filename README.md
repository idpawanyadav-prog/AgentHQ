# Agent Office Dashboard

A real-time dashboard to manage teams, tasks, and AI agents from one screen.

## Quick Start

### 1. Install dependencies (already done)
```bash
npm install
```

### 2. Start the app
```bash
npm run dev
```

This starts:
- **Next.js** on http://localhost:3000
- **Express API** on http://localhost:4000

### 3. Open in browser
```
http://localhost:3000
```

## What's Running

- **Database:** SQLite (`dev.db`) — auto-created on first run
- **Seeded data:** 1 team, 4 members (2 human + 2 AI), 5 tasks, 3 activities
- **API:** http://localhost:4000/api/teams, /tasks, /agents, /activity, /projects
- **Socket.io:** Real-time activity feed at http://localhost:4000

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
npm run dev # Start both Next.js + Express
npm run dev:next # Start Next.js only
npm run dev:server # Start Express only
npm run build # Build for production
npm run db:studio # Open Prisma Studio (visual DB editor)
```

## Environment

Edit `.env` to configure:
```env
DATABASE_URL="file:./dev.db"
PORT=4000
JWT_SECRET=<your_secret>
ANTHROPIC_API_KEY=<your_key>
OPENAI_API_KEY=<your_key>
```

## Tech Stack

- Next.js 14 + React 18
- Express.js + Socket.io
- Prisma + SQLite (dev) / PostgreSQL (production)
- Tailwind CSS
- @dnd-kit (Kanban drag-and-drop)
