import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
 console.log('🌱 Seeding database...');

 // Create a default team
 const team = await prisma.team.upsert({
 where: { id: 'default-team' },
 update: {},
 create: {
 id: 'default-team',
 name: 'Engineering Team',
 description: 'Primary engineering team',
 status: 'active',
 },
 });

 console.log(`Team: ${team.name}`);

 // Create a default project
 const project = await prisma.project.upsert({
 where: { id: 'default-project' },
 update: {},
 create: {
 id: 'default-project',
 name: 'Agent Office Dashboard',
 description: 'AI-powered project management dashboard',
 status: 'active',
 progress: 35,
 teamId: team.id,
 repoUrl: 'https://github.com/example/agent-office-dashboard',
 },
 });

 console.log(`Project: ${project.name}`);

 // Create a sprint
 const sprint = await prisma.sprint.upsert({
 where: { id: 'default-sprint' },
 update: {},
 create: {
 id: 'default-sprint',
 name: 'Sprint 1 – Milestone 1',
 goal: 'Persistent task management and Kanban board',
 status: 'active',
 order: 1,
 projectId: project.id,
 },
 });

 console.log(`Sprint: ${sprint.name}`);

 // Create members
 const alice = await prisma.member.create({
 data: {
 name: 'Alice',
 role: 'Tech Lead',
 type: 'human',
 teamId: team.id,
 },
 });

 const bob = await prisma.member.create({
 data: {
 name: 'Bob',
 role: 'Full-stack Developer',
 type: 'human',
 teamId: team.id,
 },
 });

 const claudeMember = await prisma.member.create({
 data: {
 name: 'Claude Dev #1',
 role: 'AI Developer',
 type: 'ai',
 teamId: team.id,
 },
 });

 const gptMember = await prisma.member.create({
 data: {
 name: 'GPT Coder',
 role: 'AI Developer',
 type: 'ai',
 teamId: team.id,
 },
 });

 console.log('Members: 4 created');

 // Create AI agents
 const claudeAgent = await prisma.agent.upsert({
 where: { id: 'agent-claude-1' },
 update: {},
 create: {
 id: 'agent-claude-1',
 name: 'Claude Dev #1',
 type: 'anthropic',
 model: 'claude-sonnet-4-5-20250929',
 memberId: claudeMember.id,
 config: JSON.stringify({
 temperature: 0.7,
 maxTokens: 4096,
 systemPrompt: 'You are a senior software engineer working on the Agent Office Dashboard.',
 }),
 status: 'idle',
 },
 });
 console.log('Agent: Claude Dev #1');

 const gptAgent = await prisma.agent.upsert({
 where: { id: 'agent-gpt-1' },
 update: {},
 create: {
 id: 'agent-gpt-1',
 name: 'GPT Coder',
 type: 'openai',
 model: 'gpt-4o',
 memberId: gptMember.id,
 config: JSON.stringify({
 temperature: 0.7,
 maxTokens: 4096,
 systemPrompt: 'You are a senior software engineer working on the Agent Office Dashboard.',
 }),
 status: 'idle',
 },
 });
 console.log('Agent: GPT Coder');

 // Create sample tasks
 const tasks = await prisma.task.createMany({
 data: [
 {
 title: 'Set up project scaffolding',
 description: 'Initialize Next.js project with Prisma, Express, and Socket.io',
 priority: 'high',
 status: 'done',
 type: 'task',
 teamId: team.id,
 projectId: project.id,
 sprintId: sprint.id,
 assigneeId: alice.id,
 dependencies: JSON.stringify([]),
 storyPoints: 5,
 acceptanceCriteria: JSON.stringify([
 'Project initializes with npm run dev',
 'Prisma connects to SQLite',
 'Express server starts on port 3001',
 ]),
 blocked: false,
 },
 {
 title: 'Design database schema',
 description: 'Define Prisma models for teams, tasks, agents, and activities',
 priority: 'high',
 status: 'done',
 type: 'task',
 teamId: team.id,
 projectId: project.id,
 sprintId: sprint.id,
 assigneeId: bob.id,
 dependencies: JSON.stringify([]),
 storyPoints: 3,
 acceptanceCriteria: JSON.stringify([
 'All models defined in schema.prisma',
 'Relationships properly configured',
 'Seed data populates without errors',
 ]),
 blocked: false,
 },
 {
 title: 'Implement AI proxy route',
 description: 'Create Express route that proxies Anthropic and OpenAI API calls with logging',
 priority: 'medium',
 status: 'in_progress',
 type: 'feature',
 teamId: team.id,
 projectId: project.id,
 sprintId: sprint.id,
 assigneeId: bob.id,
 dependencies: JSON.stringify([]),
 storyPoints: 8,
 acceptanceCriteria: JSON.stringify([
 'POST /api/ai/chat proxies to Anthropic',
 'POST /api/ai/chat proxies to OpenAI',
 'Requests and responses are logged',
 ]),
 blocked: false,
 },
 {
 title: 'Build Kanban board UI',
 description: 'Create drag-and-drop task board with @dnd-kit',
 priority: 'medium',
 status: 'ready',
 type: 'feature',
 teamId: team.id,
 projectId: project.id,
 sprintId: sprint.id,
 assigneeId: alice.id,
 dependencies: JSON.stringify([]),
 storyPoints: 8,
 acceptanceCriteria: JSON.stringify([
 'Board shows all status columns',
 'Tasks can be dragged between columns',
 'Board updates in real-time via Socket.io',
 ]),
 blocked: false,
 },
 {
 title: 'Add Socket.io real-time updates',
 description: 'Wire up Socket.io for live activity feed broadcasting',
 priority: 'medium',
 status: 'backlog',
 type: 'chore',
 teamId: team.id,
 projectId: project.id,
 sprintId: sprint.id,
 agentId: claudeAgent.id,
 dependencies: JSON.stringify([]),
 storyPoints: 5,
 acceptanceCriteria: JSON.stringify([
 'Socket server connects to Express',
 'Activity events broadcast to subscribed rooms',
 'Frontend listens and updates feed',
 ]),
 blocked: false,
 },
 {
 title: 'Fix authentication middleware race condition',
 description: 'JWT verification fails under concurrent requests due to shared cache',
 priority: 'critical',
 status: 'blocked',
 type: 'bug',
 teamId: team.id,
 projectId: project.id,
 sprintId: sprint.id,
 assigneeId: bob.id,
 dependencies: JSON.stringify([]),
 storyPoints: 3,
 acceptanceCriteria: JSON.stringify([
 'Auth middleware handles 100 concurrent requests',
 'No cache collisions under load',
 ]),
 blocked: true,
 blockedReason: 'Waiting for the API team to expose the new /auth/validate endpoint',
 },
 ],
 });

 console.log('Tasks: 6 created');

 // Create sample activities
 await prisma.activity.createMany({
 data: [
 {
 type: 'task_assigned',
 description: 'Task "Set up project scaffolding" assigned to Alice',
 teamId: team.id,
 memberId: alice.id,
 meta: JSON.stringify({ taskTitle: 'Set up project scaffolding' }),
 },
 {
 type: 'task_assigned',
 description: 'Task "Design database schema" assigned to Bob',
 teamId: team.id,
 memberId: bob.id,
 meta: JSON.stringify({ taskTitle: 'Design database schema' }),
 },
 {
 type: 'agent_started',
 description: 'Claude Dev #1 started working on Socket.io integration',
 teamId: team.id,
 memberId: claudeMember.id,
 meta: JSON.stringify({ taskTitle: 'Add Socket.io real-time updates' }),
 },
 ],
 });

 console.log('Activities: 3 created');

 // Seed settings
 const settings = [
 { key: 'default_anthropic_model', value: 'claude-sonnet-4-5-20250929' },
 { key: 'default_openai_model', value: 'gpt-4o' },
 { key: 'ai_rate_limit_window_ms', value: '60000' },
 { key: 'ai_rate_limit_max', value: '30' },
 ];

 for (const s of settings) {
 await prisma.setting.upsert({
 where: { key: s.key },
 update: { value: s.value },
 create: s,
 });
 }

 console.log('Settings seeded');
 console.log('✅ Done seeding');
}

main()
 .catch((e) => {
 console.error('❌ Seed failed:', e);
 process.exit(1);
 })
 .finally(async () => {
 await prisma.$disconnect();
 });
