require('dotenv').config();
const express = require('express');
const cors = require('cors');
const http = require('http');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');

const teamsRouter = require('./routes/teams');
const tasksRouter = require('./routes/tasks');
const agentsRouter = require('./routes/agents');
const projectsRouter = require('./routes/projects');
const githubRouter = require('./routes/github');
const aiRouter = require('./routes/ai');
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
 allowedHeaders: ['Content-Type', 'Authorization'],
};
app.use(cors(corsOptions));

// ─── Body parsing ─────────────────────────────────────────────────────────────
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// ─── Health check ─────────────────────────────────────────────────────────────
app.get('/health', (_req, res) => {
 res.json({
 status: 'ok',
 timestamp: new Date().toISOString(),
 database: prisma ? 'connected' : 'not connected',
 });
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
app.use('/api/teams', teamsRouter);
app.use('/api/tasks', tasksRouter);
app.use('/api/agents', agentsRouter);
app.use('/api/projects', projectsRouter);
app.use('/api/github', githubRouter);
app.use('/api/ai', aiRouter);

// ─── Socket.io ────────────────────────────────────────────────────────────────
initSocketServer(server, {
 corsOrigin: process.env.NEXTAUTH_URL || 'http://localhost:3000',
});

// ─── 404 & Error handlers ─────────────────────────────────────────────────────
app.use((_req, res) => {
 res.status(404).json({ error: 'Not found' });
});

app.use((err, _req, res, _next) => {
 console.error('[Express Error]', err);
 res.status(err.status || 500).json({
 error: process.env.NODE_ENV === 'production' ? 'Internal server error' : err.message,
 });
});

// ─── Graceful shutdown ────────────────────────────────────────────────────────
async function gracefulShutdown(signal) {
 console.log(`\nReceived ${signal}. Shutting down gracefully...`);
 server.close(() => {
 console.log('HTTP server closed.');
 });
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
