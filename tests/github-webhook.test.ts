import crypto from 'crypto';
import express from 'express';
import http from 'http';

jest.mock('../server/prisma', () => ({
 team: {
  findFirst: jest.fn(),
 },
 activity: {
  create: jest.fn(),
 },
}));

jest.mock('../server/socket', () => ({
 broadcastActivity: jest.fn(),
}));

jest.mock('@octokit/rest', () => ({
 Octokit: jest.fn().mockImplementation(() => ({
  repos: {
  get: jest.fn(),
  listCommits: jest.fn(),
  },
  pulls: {
  list: jest.fn(),
  },
 })),
}));

const prisma = require('../server/prisma');
const { broadcastActivity } = require('../server/socket');
const githubRouter = require('../server/routes/github');

const secret = 'github-webhook-test-secret';

type TestResponse = {
 status: number;
 body: string;
 json: () => unknown;
};

function signature(body: string, signingSecret = secret) {
 return `sha256=${crypto.createHmac('sha256', signingSecret).update(Buffer.from(body)).digest('hex')}`;
}

function request(url: string, options: { method?: string; headers?: Record<string, string>; body?: string } = {}) {
 return new Promise<TestResponse>((resolve, reject) => {
 const target = new URL(url);
 const req = http.request({
  hostname: target.hostname,
  port: target.port,
  path: `${target.pathname}${target.search}`,
  method: options.method || 'GET',
  headers: options.headers,
 }, (res) => {
  let body = '';
  res.setEncoding('utf8');
  res.on('data', (chunk) => { body += chunk; });
  res.on('end', () => resolve({
  status: res.statusCode || 0,
  body,
  json: () => JSON.parse(body),
  }));
 });
 req.on('error', reject);
 if (options.body) req.write(options.body);
 req.end();
 });
}

async function withServer(run: (baseUrl: string) => Promise<void>) {
 const app = express();
 app.post('/api/github/webhook', express.raw({ type: 'application/json' }), githubRouter.githubWebhookHandler);
 app.use(express.json());
 app.use('/api/github', githubRouter);

 const server = http.createServer(app);
 await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
 const address = server.address();
 if (!address || typeof address === 'string') throw new Error('Test server did not bind to a TCP port');

 try {
 await run(`http://127.0.0.1:${address.port}`);
 } finally {
 await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
 }
}

describe('GitHub webhook security', () => {
 beforeEach(() => {
 jest.clearAllMocks();
 Object.assign(process.env, { GITHUB_WEBHOOK_SECRET: secret });
 prisma.team.findFirst.mockResolvedValue({ id: 'team-1' });
 prisma.activity.create.mockImplementation(async ({ data }: { data: Record<string, unknown> }) => ({
  id: 'activity-1',
  ...data,
 }));
 });

 afterEach(() => {
 delete process.env.GITHUB_WEBHOOK_SECRET;
 });

async function postWebhook(baseUrl: string, body: string, providedSignature?: string) {
 return request(`${baseUrl}/api/github/webhook`, {
  method: 'POST',
  headers: {
  'Content-Type': 'application/json',
  'Content-Length': String(Buffer.byteLength(body)),
  'X-GitHub-Event': 'push',
  ...(providedSignature ? { 'X-Hub-Signature-256': providedSignature } : {}),
  },
  body,
 });
 }

 it('accepts a valid signature without a dashboard cookie', async () => {
 await withServer(async (baseUrl) => {
  const body = JSON.stringify({ ref: 'refs/heads/main', head_commit: { message: 'Ship webhook security' } });

  const response = await postWebhook(baseUrl, body, signature(body));

  expect(response.status).toBe(200);
  expect(response.json()).toEqual({ received: true });
  expect(prisma.activity.create).toHaveBeenCalledWith({
  data: expect.objectContaining({
   type: 'commit',
   description: 'Push to main: Ship webhook security',
   teamId: 'team-1',
  }),
  });
  expect(broadcastActivity).toHaveBeenCalledTimes(1);
 });
 });

 it('rejects an invalid signature', async () => {
 await withServer(async (baseUrl) => {
  const body = JSON.stringify({ ref: 'refs/heads/main' });

  const response = await postWebhook(baseUrl, body, 'sha256=invalid');

  expect(response.status).toBe(401);
  expect(prisma.activity.create).not.toHaveBeenCalled();
 });
 });

 it('rejects a missing signature', async () => {
 await withServer(async (baseUrl) => {
  const body = JSON.stringify({ ref: 'refs/heads/main' });

  const response = await postWebhook(baseUrl, body);

  expect(response.status).toBe(401);
  expect(prisma.activity.create).not.toHaveBeenCalled();
 });
 });

 it('rejects a modified payload signed for different bytes', async () => {
 await withServer(async (baseUrl) => {
  const originalBody = JSON.stringify({ ref: 'refs/heads/main', head_commit: { message: 'original' } });
  const modifiedBody = JSON.stringify({ ref: 'refs/heads/main', head_commit: { message: 'modified' } });

  const response = await postWebhook(baseUrl, modifiedBody, signature(originalBody));

  expect(response.status).toBe(401);
  expect(prisma.activity.create).not.toHaveBeenCalled();
 });
 });

 it('rejects requests when the webhook secret is missing', async () => {
 await withServer(async (baseUrl) => {
  delete process.env.GITHUB_WEBHOOK_SECRET;
  const body = JSON.stringify({ ref: 'refs/heads/main' });

  const response = await postWebhook(baseUrl, body, signature(body));

  expect(response.status).toBe(401);
  expect(prisma.activity.create).not.toHaveBeenCalled();
 });
 });

 it('keeps dashboard GitHub routes behind dashboard authentication', async () => {
 await withServer(async (baseUrl) => {
  const response = await request(`${baseUrl}/api/github/repo?owner=openai&repo=test`);

  expect(response.status).toBe(401);
 });
 });
});
