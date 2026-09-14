require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const githubRouter = require('./routes/github');
const aiRouter = require('./routes/ai');
const securityHeaders = require('./middleware/security-headers');
const errorHandler = require('./middleware/error-handler');
const { initSocketServer, broadcastActivity } = require('./socket');

const prisma = new PrismaClient();
const app = express();
const server = http.createServer(app);
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

// ─── CORS ─────────────────────────────────────────────────────────────────────
const corsOptions = {
 origin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
 credentials: true,
 methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
 allowedHeaders: ['Content-Type', 'Authorization', 'X-GitHub-Event', 'X-Hub-Signature-256'],
};
app.use(cors(corsOptions));

// ─── Security headers (CSP, HSTS, framing, content-type) ──────────────────────
app.use(securityHeaders);

// GitHub verifies signatures against the exact raw body and does not have a dashboard session.
app.post('/api/github/webhook', express.raw({ type: 'application/json', limit: '10mb' }), githubRouter.githubWebhookHandler);

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
 res.json({
 status: 'ok',
 timestamp: new Date().toISOString(),
 service: 'realtime',
 });
});

// Readiness probe — verifies DB connectivity before reporting ready
let dbReady = false;
app.get('/ready', async (_req, res) => {
 try {
 await prisma.$queryRaw`SELECT 1`;
 if (!dbReady) dbReady = true;
 res.json({ ready: true, database: 'ok', timestamp: new Date().toISOString() });
 } catch (err) {
 res.status(503).json({ ready: false, database: 'unreachable', error: err.message });
 }
});

// ─── Auth utility (inline JWT verification for API routes) ────────────────────
app.use('/api', async (req, res, next) => {
 try {
  const {authenticate} = require('./session');
  if(!await authenticate(req.headers.cookie || '')) return res.status(401).json({error:'Sign in required'});
  req.user = {role:'admin'};
  return next();
 } catch(e) { return res.status(500).json({error:'Authentication unavailable'}); }
});

// ─── Mount routes ─────────────────────────────────────────────────────────────
app.use('/api/github', githubRouter);
app.use('/api/ai', aiRouter);

// Next.js is authoritative for core APIs; preserve the incoming origin/cookie.
app.use('/api', (req,res)=>{
 const target=new URL(req.originalUrl,process.env.WEB_ORIGIN || 'http://127.0.0.1:3000');
 const headers={...req.headers};delete headers['content-length'];delete headers['transfer-encoding'];
 const upstream=http.request(target,{method:req.method,headers},response=>{res.writeHead(response.statusCode,response.headers);response.pipe(res);});
 upstream.on('error',()=>{if(!res.headersSent)res.status(502).json({error:'Web API unavailable'});});
 if(!['GET','HEAD'].includes(req.method))upstream.write(JSON.stringify(req.body || {}));
 upstream.end();
});

// ─── Socket.io ────────────────────────────────────────────────────────────────
const io=initSocketServer(server, {
 corsOrigin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
});

const stopMonitor=require('./realtime-monitor').startRealtimeMonitor(io);

// ─── 404 & Error handlers ─────────────────────────────────────────────────────
app.use((_req, res) => {
 res.status(404).json({ error: 'Not found' });
});

// Shared, safe error handler — detailed diagnostics stay in server logs
app.use(errorHandler);

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
 console.log(`\nReceived ${signal}. Shutting down gracefully...`);
 server.close(() => {
 console.log('HTTP server closed.');
 });
 stopMonitor();
 await prisma.$disconnect();
 process.exit(0);
}

process.on('SIGINT', () => gracefulShutdown('SIGINT'));
process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = parseInt(process.env.PORT || '4000', 10);
server.listen(PORT, () => {
 console.log(`🚀 Express server listening on http://localhost:${PORT}`);
 console.log(`📡 Socket.io initialized`);
 console.log(`💾 Prisma connected to ${process.env.DATABASE_URL?.replace(/:[^@]*@/, ':***@') || 'database'}`);
});

module.exports = { app, server, prisma };
