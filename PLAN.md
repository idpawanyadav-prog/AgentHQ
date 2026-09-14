# Agent Office Dashboard — Production Plan

## Vision
Build a fully production-ready AI agent company platform — a command center where AI agents work as team members, managed through a real-time dashboard. Single API key per provider, GitHub as the source of truth for code, Electron desktop app included.

---

## Tech Stack

| Layer | Technology | Purpose |
|---|---|---|
| Frontend | Next.js 14 (Pages Router) | Web app + SSR for dashboard |
| Backend API | Express.js | REST API, AI proxy, GitHub integration |
| Database | PostgreSQL | All persistent data |
| ORM | Prisma | Database access + migrations |
| Real-time | Socket.io | Live activity feed |
| Auth | NextAuth.js (GitHub OAuth) | Admin authentication |
| AI Providers | Anthropic (Claude) + OpenAI (GPT) | Single key each, proxied |
| Code Hosting | GitHub | Repos, PRs, CI/CD |
| Desktop | Electron | Phase 2 packaging |
| Styling | Tailwind CSS | All UI |
| State | Zustand | Client-side state |
| Validation | Zod | API input validation |
| Icons | lucide-react | UI icons |

---

## System Architecture

```
┌──────────────────────────────────────────────────────────────┐
│ Client Layer │
│ ┌─────────────────────┐ ┌────────────────────────┐ │
│ │ Next.js Web App │ │ Electron Desktop │ │
│ │ (Port 3000) │ │ (Phase 2) │ │
│ │ React + Tailwind │ │ Same codebase │ │
│ └──────────┬──────────┘ └────────────────────────┘ │
└─────────────┼───────────────────────────────────────────────┘
 │
 ┌───────┴────────┐
 │ Nginx / PM2 │ (Reverse proxy + process manager)
 └───────┬────────┘
 │
 ┌───────────┼────────────┐
 │ │ │
┌─────┐ ┌────────┐ ┌────────┐
│ Next │ │ Express │ │ Socket │
│ API │ │ API │ │ Server│
│Rout │ │ │ │ │
└──┬───┘ └───┬────┘ └───┬────┘
 │ │ │
 └───────────┼────────────┘
 │
 ┌─────────┼─────────┐
 │ │ │
 ┌─────┐ ┌──────┐ ┌────────┐
 │Prism│ │GitHub│ │ AI API │
 │ ORM │ │ API │ │ Proxy │
 └──┬──┘ └──────┘ └───┬────┘
 │ │
 ┌──┴─────────────┐ ┌──┴──────────┐
 │ PostgreSQL │ │ Anthropic + │
 │ │ │ OpenAI API │
 └────────────────┘ └─────────────┘
```

---

## Database Schema (Prisma)

```prisma
model Team {
 id String @id @default(cuid())
 name String
 description String?
 status String @default("active") // active | paused | archived
 project Project?
 members Member[]
 tasks Task[]
 activities Activity[]
 createdAt DateTime @default(now())
 updatedAt DateTime @updatedAt
}

model Member {
 id String @id @default(cuid())
 name String
 role String // PM, Dev, QA, Reviewer, Tester
 type String // "human" | "ai"
 avatar String?
 teamId String
 team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
 assigned Task[]
 agents Agent[]
 createdAt DateTime @default(now())
 updatedAt DateTime @updatedAt
}

model Agent {
 id String @id @default(cuid())
 name String // "Claude Dev #1"
 type String // "anthropic" | "openai"
 model String // "claude-sonnet-4-5" | "gpt-4o"
 memberId String
 member Member @relation(fields: [memberId], references: [id], onDelete: Cascade)
 tasks Task[]
 config Json // { temperature, maxTokens, systemPrompt, tools }
 status String @default("idle") // idle | working | error
 createdAt DateTime @default(now())
 updatedAt DateTime @updatedAt
}

model Project {
 id String @id @default(cuid())
 name String
 description String?
 status String @default("active") // active | paused | completed | archived
 progress Int @default(0) // 0-100
 teamId String @unique
 team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
 milestones Milestone[]
 repoUrl String?
 createdAt DateTime @default(now())
 updatedAt DateTime @updatedAt
}

model Milestone {
 id String @id @default(cuid())
 title String
 status String @default("pending") // pending | in_progress | done | blocked
 order Int
 projectId String
 project Project @relation(fields: [projectId], references: [id], onDelete: Cascade)
 createdAt DateTime @default(now())
 updatedAt DateTime @updatedAt
}

model Task {
 id String @id @default(cuid())
 title String
 description String?
 priority String @default("medium") // low | medium | high | critical
 status String @default("backlog") // backlog | in_progress | review | done
 teamId String
 team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
 assigneeId String?
 assignee Member? @relation(fields: [assigneeId], references: [id])
 agentId String?
 agent Agent? @relation(fields: [agentId], references: [id])
 branch String? // git branch
 prNumber Int? // GitHub PR number
 dependencies String[] // task IDs
 createdAt DateTime @default(now())
 updatedAt DateTime @updatedAt
}

model Activity {
 id String @id @default(cuid())
 type String // task_assigned | commit | pr_opened | pr_merged | pr_reviewed | ci_passed | ci_failed | agent_started | agent_completed | agent_error | file_read | agent_message
 message String
 meta Json? // { prNumber, branch, tokensUsed, fileName, commitSha, ciStatus }
 teamId String
 team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
 memberId String?
 member Member? @relation(fields: [memberId], references: [id])
 taskId String?
 task Task? @relation(fields: [taskId], references: [id])
 createdAt DateTime @default(now())
}

model Setting {
 id String @id @default(cuid())
 key String @unique
 value String
 createdAt DateTime @default(now())
 updatedAt DateTime @updatedAt
}

model GitHubRepo {
 id String @id @default(cuid())
 teamId String
 team Team @relation(fields: [teamId], references: [id], onDelete: Cascade)
 owner String
 repo String
 branch String @default("main")
 webhookId String?
 lastSync DateTime @default(now())
 createdAt DateTime @default(now())
 updatedAt DateTime @updatedAt

 @@unique([owner, repo])
}

model AICallLog {
 id String @id @default(cuid())
 agentId String
 agent Agent @relation(fields: [agentId], references: [id], onDelete: Cascade)
 provider String // "anthropic" | "openai"
 model String
 taskId String?
 task Task? @relation(fields: [taskId], references: [id])
 tokensIn Int
 tokensOut Int
 durationMs Int
 success Boolean
 error String?
 createdAt DateTime @default(now())
}
```

---

## Production Tech Stack & Infrastructure

### Hosting & Deployment

| Service | Purpose | Cost (Est.) |
|---|---|---|
| **VPS / Cloud VM** (DigitalOcean, AWS EC2, GCP) | Host Next.js + Express + PostgreSQL | $40-100/mo |
| **PostgreSQL** | Database (same VM or managed like Supabase/Railway) | $0-25/mo |
| **Nginx** | Reverse proxy, SSL, static file serving | Free |
| **PM2** | Process manager (keep app running, auto-restart) | Free |
| **Let's Encrypt** | SSL certificates | Free |
| **GitHub Actions** | CI/CD for your platform itself | Free (public) / $4/mo (private) |
| **GitHub** | Repo hosting for agent projects | Free (public) / $4/mo |

### Recommended: VPS Setup

```
DigitalOcean Droplet: $48/mo (2 CPU, 4GB RAM, 80GB SSD)
OR
AWS EC2 t3.small: ~$15/mo + RDS PostgreSQL ~$15/mo
```

---

## Environment Variables

```env
# .env.local (Next.js - exposed to browser via NEXT_PUBLIC_ prefix)
NEXT_PUBLIC_API_URL=http://localhost:4000
NEXT_PUBLIC_SOCKET_URL=http://localhost:4000
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=<openssl rand -base64 32>
GITHUB_ID=<github_oauth_client_id>
GITHUB_SECRET=<github_oauth_client_secret>

# .env (Express server - NEVER exposed to browser)
DATABASE_URL="postgresql://user:pass@localhost:5432/agent_office"
PORT=4000
JWT_SECRET=<openssl rand -base64 32>
NODE_ENV=production

# AI Provider Keys (SINGLE KEY per provider)
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...

# GitHub Integration
GITHUB_WEBHOOK_SECRET=<random_string_for_webhook_validation>
GITHUB_TOKEN=<personal_access_token_for_api_access>

# Optional: External services
REDIS_URL=redis://localhost:6379 # for rate limiting / caching
```

---

## File Structure

```
agent-office-dashboard/
├── package.json
├── next.config.js
├── tailwind.config.js
├── tsconfig.json
├── postcss.config.js
├── .eslintrc.json
├── .env.example
├── .env.local # gitignored - actual keys
├── .gitignore
│
├── docker-compose.yml # PostgreSQL + app
├── Dockerfile # Production image
├── ecosystem.config.js # PM2 config
│
├── prisma/
│ ├── schema.prisma
│ └── migrations/
│ └── init/
│
├── server/ # Express backend
│ ├── index.js # Express entry point
│ ├── routes/
│ │ ├── teams.js # Team CRUD
│ │ ├── tasks.js # Task CRUD + assignment
│ │ ├── agents.js # Agent config + control
│ │ ├── projects.js # Project CRUD
│ │ ├── github.js # GitHub API + webhooks
│ │ ├── ai.js # AI proxy (single key)
│ │ └── auth.js # JWT auth routes
│ ├── middleware/
│ │ ├── auth.js # JWT verification
│ │ ├── rateLimit.js # AI call rate limiting
│ │ └── validate.js # Zod validation
│ └── socket/
│ └── index.js # Socket.io + activity broadcast
│
├── lib/ # Shared utilities
│ ├── prisma.ts # Prisma client singleton
│ ├── socket-client.ts # Socket.io client helper
│ ├── github.ts # GitHub API integration
│ ├── ai-orchestrator.js # Agent process management
│ ├── activity-logger.js # Central activity logging
│ └── validators.js # Zod schemas
│
├── components/ # Reusable React components
│ ├── Layout.tsx # App shell (sidebar + topbar)
│ ├── Sidebar.tsx # Navigation sidebar
│ ├── TopBar.tsx # Search, notifications, user
│ ├── StatCard.tsx # Overview stat card
│ ├── TeamCard.tsx # Team overview card
│ ├── TaskBoard.tsx # Kanban board
│ ├── TaskCard.tsx # Individual task card
│ ├── ActivityFeed.tsx # Live activity stream
│ ├── AgentCard.tsx # Agent status card
│ ├── AgentDetail.tsx # Full agent view + timeline
│ ├── ProjectProgress.tsx # Milestone tracker
│ ├── Modal.tsx # Reusable modal
│ ├── Loading.tsx # Loading spinners
│ └── ErrorBoundary.tsx # Error handling
│
├── pages/ # Next.js pages
│ ├── _app.tsx # App wrapper
│ ├── _document.tsx # HTML document
│ ├── index.tsx # Overview / Dashboard
│ ├── login.tsx # Login page
│ ├── teams.tsx # Teams list
│ ├── teams/
│ │ └── [id].tsx # Team detail + Kanban
│ ├── agents.tsx # Agents list
│ ├── agents/
│ │ └── [id].tsx # Agent detail
│ ├── projects.tsx # Projects list
│ ├── projects/
│ │ └── [id].tsx # Project detail
│ ├── activity.tsx # Activity log
│ ├── settings.tsx # Settings page
│ └── api/ # Next.js API routes
│ ├── auth/
│ │ └── [...nextauth].ts # NextAuth config
│ ├── teams/
│ │ ├── index.ts # GET list, POST create
│ │ └── [id].ts # GET, PUT, DELETE
│ ├── tasks/
│ │ ├── index.ts # GET list, POST create
│ │ └── [id].ts # GET, PUT, DELETE
│ ├── agents/
│ │ ├── index.ts # GET list, POST create
│ │ └── [id].ts # GET, PUT, DELETE, POST start/stop
│ ├── projects/
│ │ ├── index.ts
│ │ └── [id].ts
│ ├── activity/
│ │ └── index.ts # GET activity feed (SSE fallback)
│ └── webhooks/
│ └── github.ts # GitHub webhook receiver
│
├── styles/
│ └── globals.css
│
├── types/
│ └── index.ts # TypeScript interfaces
│
├── public/
│ ├── favicon.ico
│ └── logo.svg
│
└── tests/ # Tests
 ├── unit/
 │ ├── validators.test.js
 │ ├── ai-proxy.test.js
 │ └── github-integration.test.js
 ├── integration/
 │ ├── teams.test.js
 │ ├── tasks.test.js
 │ └── agents.test.js
 └── e2e/
 ├── dashboard.spec.js # Playwright
 └── kanban.spec.js
```

---

## Phase 1: Core Platform (Weeks 1-4)

### Week 1: Foundation

**Backend Developer Tasks:**
1. Initialize project: package.json, tsconfig, all config files
2. Set up Prisma: schema.prisma, PostgreSQL connection, migrations
3. Create Express server: routes, middleware, Socket.io setup
4. Set up NextAuth with GitHub OAuth
5. Create `.env.example` and `.env.local`

**Frontend Developer Tasks:**
1. Set up Next.js project, Tailwind, PostCSS
2. Create global CSS with dashboard theme
3. Build Layout component: Sidebar + TopBar + content area
4. Create pages/_app.tsx with Socket.io client
5. Build TypeScript types (Team, Member, Agent, Task, Activity, Project)

**Dependencies to Install:**
```
npm install next react react-dom
npm install express cors dotenv socket.io socket.io-client
npm install prisma @prisma/client @next-auth/prisma-adapter next-auth
npm install zod bcryptjs jsonwebtoken
npm install @octokit/rest
npm install @anthropic-ai/sdk openai
npm install zustand date-fns lucide-react axios
npm install react-draggable @dnd-kit/core @dnd-kit/sortable
npm install -D typescript @types/node @types/react @types/react-dom
npm install -D @types/express @types/bcryptjs @types/jsonwebtoken
npm install -D tailwindcss autoprefixer postcss nodemon
```

**Acceptance Criteria:**
- [ ] `npm run dev` starts both Next.js and Express
- [ ] PostgreSQL database created and Prisma migrations run successfully
- [ ] GitHub OAuth login works and redirects to dashboard
- [ ] Database has all tables (Team, Member, Agent, Task, Activity, Project, Milestone, Setting)

---

### Week 2: Teams & Tasks (Frontend)

**Frontend Developer Tasks:**
1. Build Overview page (index.tsx):
 - Stat cards row (Teams, Agents, Tasks, Builds)
 - Teams at a Glance horizontal cards
 - Live Activity Feed with Socket.io integration

2. Build Teams page (teams.tsx):
 - "New Team" button with modal form
 - Team card grid
 - Each card: name, members count, progress, last active, action buttons

3. Build Team Detail page (teams/[id].tsx):
 - Team header with info
 - Member list with human/AI badges
 - Task tabs: All | Active | Completed

4. Build Task Board (TaskBoard + TaskCard components):
 - 4 columns: Backlog | In Progress | Review | Done
 - Drag-and-drop using @dnd-kit
 - Task cards: title, priority badge, assignee avatar, PR link, CI status
 - Click card → modal with full details + comments

**Acceptance Criteria:**
- [ ] Admin can create a new team with name and description
- [ ] Admin can add members (human or AI) to a team
- [ ] Admin can create tasks with title, description, priority
- [ ] Tasks can be assigned to team members or left unassigned
- [ ] Kanban board shows all 4 columns with drag-and-drop
- [ ] Moving a task updates its status in real-time

---

### Week 3: Backend API + AI Proxy

**Backend Developer Tasks:**
1. Build Express routes:
 - `GET/POST /api/teams` — list and create teams
 - `GET/PUT/DELETE /api/teams/:id` — get, update, delete team
 - `GET/POST /api/tasks` — list and create tasks
 - `GET/PUT/DELETE /api/tasks/:id` — get, update, delete task
 - `GET/POST /api/agents` — list and create agents
 - `GET/PUT /api/agents/:id` — update agent config, status
 - `GET/POST /api/projects` — list and create projects

2. Build AI proxy route (`POST /api/ai/chat`):
 - Accepts: { agentId, provider, model, messages, taskId }
 - Validates JWT, checks agent exists
 - Calls Anthropic or OpenAI API (single key)
 - Logs every call to AICallLog table
 - Returns AI response + usage metadata
 - Rate limits: max 100 requests/minute

3. Build auth middleware:
 - JWT verification on all protected routes
 - Extract user from NextAuth session

**Acceptance Criteria:**
- [ ] All CRUD routes work for teams, tasks, agents, projects
- [ ] AI proxy successfully calls Anthropic API with single key
- [ ] AI proxy logs every call to database
- [ ] Unauthorized requests return 401
- [ ] Rate limiting blocks excessive AI calls

---

### Week 4: Real-time + Integration

**Backend Developer Tasks:**
1. Socket.io setup:
 - Namespace for activity broadcasts
 - `activity:new` event emitted on every new activity
 - Room-based subscriptions per team

2. Activity logging service:
 - `logActivity(teamId, type, message, meta, memberId, taskId)`
 - Called from routes, webhooks, agent output

3. Wire Socket.io to frontend:
 - Connect on app load
 - Listen for `activity:new` events
 - Update activity feed without refresh

**Frontend Developer Tasks:**
1. Build Activity Feed component:
 - Real-time list of activities
 - Color-coded by type (commits=green, PRs=blue, agent=purple)
 - Timestamps with relative time ("3 min ago")
 - Auto-scroll to newest

2. Connect all pages to backend API:
 - Replace mock data with actual API calls
 - Add loading states, error handling
 - Use Zustand for client state

**Acceptance Criteria:**
- [ ] Creating a task broadcasts to all connected clients
- [ ] Activity feed updates without page refresh
- [ ] Multiple browser tabs see the same real-time updates
- [ ] All CRUD operations persist to database
- [ ] Overview page shows real data from database

---

## Phase 2: GitHub Integration (Weeks 5-6)

### Week 5: GitHub Webhooks + API

**Backend Developer Tasks:**
1. GitHub webhook receiver (`POST /api/webhooks/github`):
 - Validate webhook signature
 - Handle events: push, pull_request, issues, check_run
 - Convert events to Activity entries
 - Update task status based on PR events

2. GitHub API integration:
 - Octokit client with app token
 - Repo listing, PR fetching, CI status
 - Periodic polling (every 5 min) for repos without webhooks

3. GitHubRepo model in database:
 - Link repos to teams
 - Store owner, repo, branch, webhook ID
 - Track last sync time

**Acceptance Criteria:**
- [ ] GitHub webhook URL receives and validates events
- [ ] Push events create "commit" activities
- [ ] PR open/close/merge events create activities
- [ ] CI pass/fail events update activity feed
- [ ] Task cards show linked PR numbers

---

### Week 6: Code Activity UI

**Frontend Developer Tasks:**
1. Update Activity Feed:
 - Show commit messages with repo links
 - Show PR open/merge events with PR numbers
 - Show CI status (passing/failing)
 - Filter by type (commits, PRs, CI, agent)

2. Build Agent Detail page (agents/[id].tsx):
 - Agent info sidebar (name, model, status, stats)
 - Current task section
 - Activity timeline (file reads, commits, PRs, messages)
 - Context panel: files currently being worked on

3. Update Task Card:
 - Show linked branch name
 - Show PR number with link to GitHub
 - Show CI status badge
 - Show assignee with avatar

**Acceptance Criteria:**
- [ ] Activity feed shows commits, PRs, CI events from GitHub
- [ ] Agent detail page shows full activity timeline
- [ ] Task cards display GitHub PR links and CI status
- [ ] All GitHub data is clickable and links to actual GitHub pages

---

## Phase 3: AI Agent Orchestration (Weeks 7-8)

### Week 7: Agent Spawner

**Backend Developer Tasks:**
1. AI Orchestrator (lib/ai-orchestrator.js):
 - `spawnAgent(agentId, taskId)` — starts an AI agent process
 - `stopAgent(agentId)` — kills the process
 - Manages Claude Code CLI subprocess
 - Captures stdout/stderr from agent

2. Agent workspace:
 - Creates temp directory per agent
 - Clones repo to workspace
 - Writes task description to workspace
 - Agent reads task, writes code, commits, pushes

3. Task assignment flow:
 - Admin assigns task to AI agent
 - Backend spawns agent process
 - Agent status changes to "working"
 - Activity broadcast: "agent started working on [task]"

**Acceptance Criteria:**
- [ ] Assigning task to AI agent spawns Claude Code process
- [ ] Agent workspace is created with repo + task description
- [ ] Agent status changes to "working" in real-time
- [ ] Agent output is captured and logged as activities

---

### Week 8: Agent Monitoring + Logging

**Backend Developer Tasks:**
1. Activity parsing from agent output:
 - Parse file reads from stdout
 - Parse commits from git output
 - Parse PR URLs from agent output
 - Log each as separate Activity entry

2. Error handling:
 - Catch agent crashes
 - Log error to Activity + AICallLog
 - Set agent status to "error"
 - Notify via Socket.io

3. Agent lifecycle:
 - Task complete → agent commits, opens PR
 - Agent status → "idle"
 - Activity broadcast: "agent completed [task]"

**Frontend Developer Tasks:**
1. Agent status indicators:
 - Idle: green dot
 - Working: yellow spinner + progress
 - Error: red dot with error message

2. Real-time agent status updates via Socket.io

**Acceptance Criteria:**
- [ ] Agent file reads appear in activity feed
- [ ] Agent commits appear in activity feed
- [ ] Agent PR opens appear in activity feed
- [ ] Agent errors are caught and displayed
- [ ] Agent status updates in real-time on dashboard

---

## Phase 4: Polish + Electron (Weeks 9-10)

### Week 9: UI Polish + Search

**Frontend Developer Tasks:**
1. Global search:
 - Search bar in TopBar
 - Searches tasks, agents, teams, PRs
 - Keyboard shortcut (Cmd+K)
 - Dropdown with results

2. Settings page:
 - API key configuration (Anthropic, OpenAI, GitHub)
 - Default model selection per provider
 - Rate limit configuration
 - GitHub repo connection

3. UI polish:
 - Loading skeletons on all pages
 - Error boundaries on all routes
 - Empty states (no teams, no tasks, etc.)
 - Toast notifications for actions

**Acceptance Criteria:**
- [ ] Global search returns results across all entities
- [ ] Settings page allows configuring API keys
- [ ] All pages have loading states
- [ ] Error states are user-friendly
- [ ] Toast notifications on all major actions

---

### Week 10: Electron + Deployment

**Frontend Developer Tasks:**
1. Electron wrapper:
 - main.js / preload.js
 - Load Next.js app in BrowserWindow
 - Menu bar with File, Edit, View
 - System tray integration
 - Auto-update support (electron-updater)

2. Electron build:
 - electron-builder config
 - Build for Windows, Mac, Linux
 - Installer creation

**Backend Developer Tasks:**
1. Production deployment setup:
 - Dockerfile for app
 - docker-compose.yml (app + PostgreSQL)
 - PM2 ecosystem config
 - Nginx config (reverse proxy, SSL)
 - Deployment script (VPS setup)

2. CI/CD pipeline (GitHub Actions):
 - Run tests on PR
 - Build on merge to main
 - Deploy to VPS on main

**QA Tasks:**
1. End-to-end testing:
 - Login flow
 - Create team → add members → create tasks
 - Assign task to AI agent
 - Verify activity feed updates
 - GitHub webhook simulation

2. Performance testing:
 - Load test with 100+ activities
 - Socket.io connection stability
 - Database query performance

**Acceptance Criteria:**
- [ ] Electron app launches and shows dashboard
- [ ] Installer builds successfully for Windows
- [ ] PM2 keeps app running (auto-restart on crash)
- [ ] Nginx serves app with SSL
- [ ] All tests passing
- [ ] Deployment script works on fresh VPS

---

## Security Requirements

### Authentication & Authorization
- GitHub OAuth for admin login
- JWT tokens for API authentication (1 hour expiry)
- Refresh token mechanism (7 day expiry)
- All API routes protected except webhooks

### API Key Security
- Single API keys stored in `.env.local` only
- Keys NEVER exposed to frontend
- Keys NEVER logged in plain text
- Keys rotated on schedule (remind every 90 days)
- Backend proxies ALL AI calls — agents never call APIs directly

### Data Protection
- All passwords hashed with bcrypt (if adding user management later)
- SQL injection prevented via Prisma parameterized queries
- XSS prevented via React's built-in escaping
- CSRF tokens on all state-changing API routes
- Webhook signature validation (GitHub HMAC)

### Rate Limiting
- AI API calls: max 100/minute per agent
- General API: max 1000/minute per IP
- Socket.io connections: max 10 per user
- GitHub API: respect rate limits, use conditional requests

---

## Monitoring & Observability

### Application Monitoring
- PM2 logs: stdout/stderr captured
- PM2 metrics: CPU, memory, uptime
- Health check endpoint: `GET /api/health`

### Database Monitoring
- Connection pool size
- Query performance (slow query log)
- Table sizes and growth

### AI Usage Tracking
- AICallLog table: every AI call logged
- Track: tokens in/out, duration, success/failure
- Track per agent, per task, per provider
- Daily summary: total calls, total tokens, success rate

### Error Tracking
- Unhandled exceptions logged
- Agent crashes captured and reported
- Failed AI calls retried with exponential backoff

---

## Testing Strategy

### Unit Tests (Jest)
- Validators (Zod schemas)
- AI proxy logic
- GitHub integration helpers
- Activity logger

### Integration Tests (Jest + Supertest)
- All API routes (CRUD for teams, tasks, agents)
- Auth middleware
- Socket.io connection
- GitHub webhook handling

### E2E Tests (Playwright)
- Login flow
- Create team → add members → create tasks
- Kanban drag-and-drop
- Agent assignment workflow
- Real-time activity updates

### Test Coverage Target
- Backend: 80%+
- Frontend: 60%+
- Critical paths: 100%

---

## Deployment Checklist

### Pre-Deployment
- [ ] All tests passing
- [ ] Environment variables configured
- [ ] Database migrations run
- [ ] GitHub OAuth app created
- [ ] GitHub personal access token created
- [ ] AI API keys added
- [ ] SSL certificates obtained (Let's Encrypt)
- [ ] Nginx configured
- [ ] PM2 ecosystem config ready
- [ ] Firewall rules set (ports 22, 80, 443)

### Deployment Steps
1. Push code to GitHub
2. SSH into VPS
3. Clone repo
4. Install dependencies (`npm install`)
5. Set up `.env.local` with production values
6. Run `npx prisma migrate deploy`
7. Build app (`npm run build`)
8. Start with PM2 (`pm2 start ecosystem.config.js`)
9. Configure Nginx reverse proxy
10. Set up SSL with Certbot
11. Verify: `curl https://yourdomain.com/api/health`

### Post-Deployment
- [ ] Health check returns 200
- [ ] Login works via GitHub OAuth
- [ ] Teams can be created
- [ ] Tasks can be created and assigned
- [ ] Activity feed is live
- [ ] GitHub webhooks receive events
- [ ] PM2 monitoring active (`pm2 monit`)
- [ ] Database backups configured (daily)

---

## Scaling Plan

### When to Scale

| Metric | Scale Trigger |
|---|---|
| Concurrent users | > 10 active users |
| AI API calls | > 1000/day |
| Database size | > 1GB |
| Response time | > 500ms average |

### Scaling Options

1. **Horizontal (same server):**
 - Increase PM2 instances (cluster mode)
 - Increase Node.js memory limit

2. **Vertical (bigger server):**
 - Upgrade VPS: 4 CPU, 8GB RAM, 160GB SSD
 - Cost: ~$96/mo

3. **Separate services:**
 - Move PostgreSQL to managed service (Supabase, Railway)
 - Move Socket.io to separate process
 - Add Redis for caching + rate limiting

4. **CDN:**
 - Cloudflare for static assets
 - Reduce server load for dashboard

---

## Maintenance Schedule

### Daily
- Monitor PM2 logs for errors
- Check AI call success rate

### Weekly
- Review activity logs
- Check database size
- Verify backups completed

### Monthly
- Update dependencies (`npm update`)
- Review and rotate API keys if needed
- Performance review (slow queries, response times)
- Security audit (npm audit)

### Quarterly
- Major dependency updates
- Infrastructure cost review
- Feature planning for next quarter

---

## Cost Breakdown (Monthly)

| Item | Cost |
|---|---|
| VPS (DigitalOcean 2CPU/4GB) | $48/mo |
| PostgreSQL (managed, optional) | $0-25/mo |
- GitHub Pro (if private repos) | $4/mo |
| Anthropic API (usage-based) | ~$50-200/mo |
| OpenAI API (usage-based) | ~$20-100/mo |
| Domain name | $1/mo |
| SSL certificate | Free |
| **Total** | **$75-380/mo** |

AI API costs scale with usage. For a small team (3-5 AI agents), expect $50-150/month.

---

## Risk Management

| Risk | Mitigation |
|---|---|
| AI API key leaked | Keys never in frontend, stored in .env.local only, rotate quarterly |
| Agent runaway costs | Rate limiting (100 req/min), daily spend alerts, manual stop |
| GitHub API rate limits | Use app tokens (5000/hr), cache responses, respect Retry-After |
| Database failure | Daily backups, point-in-time recovery (managed PG), replication |
| Single point of failure | PM2 auto-restart, health checks, monitoring alerts |
| Agent crashes | Try/catch everywhere, error logging, status tracking, auto-restart |

---

## Success Criteria

1. Admin logs in via GitHub OAuth
2. Creates a team with human + AI members
3. Creates projects with milestones
4. Creates tasks and assigns to team members or AI agents
5. Kanban board updates in real-time across all clients
6. AI agents complete tasks autonomously via Claude Code CLI
7. GitHub activity (commits, PRs, CI) flows into activity feed
8. Agent detail page shows full timeline of work
9. Electron desktop app packages and runs
10. Production deployment on VPS with SSL + auto-deploy

---

## What This Enables (The Company)

```
YOUR AI SOFTWARE COMPANY
│
├── You (Owner/Architect)
│ └── Dashboard shows everything
│
├── Teams (you create in dashboard)
│ ├── Desktop App Team (2 humans + 4 AI agents)
│ ├── Mobile App Team (1 human + 3 AI agents)
│ └── Client Project Teams (as you get clients)
│
├── AI Agents (managed by platform)
│ ├── 🤖 Claude Dev — writes code
│ ├── 🤖 Claude Dev #2 — writes code
│ ├── 🤖 GPT-4 Reviewer — reviews code
│ ├── 🤖 Haiku Tester — runs tests
│ └── 🤖 More agents per team as needed
│
├── Projects
│ ├── Internal: Dashboard itself
│ ├── Client A: E-commerce Platform
│ ├── Client B: Mobile Banking App
│ └── Client C: SaaS Dashboard
│
└── Clients see progress via their project view
 └── Transparent: tasks, commits, PRs, timeline
```
