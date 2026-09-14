const { Server } = require('socket.io');

let io = null;

/**
 * Initialize Socket.io on the given HTTP server.
 *
 * Channels:
 * - `activity:<teamId>` — team-scoped activity feed updates
 * - `agent:<agentId>` — single-agent status / output updates
 * - `task:<taskId>` — task-scoped events
 * - `system` — global system events (settings changes, errors)
 */
function initSocketServer(httpServer, options = {}) {
 io = new Server(httpServer, {
 cors: {
 origin: options.corsOrigin || process.env.NEXTAUTH_URL || 'http://localhost:3000',
 methods: ['GET', 'POST'],
 credentials: true,
 },
 transports: ['websocket', 'polling'],
 });

 io.use(async (socket, next) => {
 try { const {authenticate}=require('../session'); if(!await authenticate(socket.handshake.headers.cookie || '')) return next(new Error('Sign in required')); next(); } catch(e) { next(new Error('Authentication unavailable')); }
 });
 io.on('connection', (socket) => {
 const { userId, teamId } = socket.handshake.auth || {};

 if (teamId) {
 socket.join(`team:${teamId}`);
 }

 socket.on('join:team', (incomingTeamId) => {
 if (typeof incomingTeamId === 'string' && incomingTeamId.length > 0) {
 socket.join(`team:${incomingTeamId}`);
 socket.emit('joined:team', incomingTeamId);
 }
 });

 socket.on('leave:team', (incomingTeamId) => {
 if (typeof incomingTeamId === 'string') {
 socket.leave(`team:${incomingTeamId}`);
 }
 });

 socket.on('join:agent', (agentId) => {
 if (typeof agentId === 'string') socket.join(`agent:${agentId}`);
 });

 socket.on('leave:agent', (agentId) => {
 if (typeof agentId === 'string') socket.leave(`agent:${agentId}`);
 });

 socket.on('join:task', (taskId) => {
 if (typeof taskId === 'string') socket.join(`task:${taskId}`);
 });

 socket.on('leave:task', (taskId) => {
 if (typeof taskId === 'string') socket.leave(`task:${taskId}`);
 });

 socket.on('disconnect', (reason) => {
 // Reserved for telemetry / cleanup later.
 void reason;
 });

 // Echo for client-side heartbeat checks
 socket.on('ping', (ts, ack) => {
 if (typeof ack === 'function') ack({ ts, serverTime: Date.now() });
 });

 void userId;
 });

 return io;
}

function getIO() {
 if (!io) {
 throw new Error('Socket.io has not been initialized — call initSocketServer first.');
 }
 return io;
}

/**
 * Broadcast a new activity event to the team channel.
 * @param {object} activity - Prisma Activity row (or its public projection).
 */
function broadcastActivity(activity) {
 if (!io) return;
 const payload = {
 id: activity.id,
 type: activity.type,
 description: activity.description,
 meta: activity.meta || {},
 teamId: activity.teamId,
 memberId: activity.memberId || null,
 taskId: activity.taskId || null,
 createdAt: activity.createdAt,
 };
 io.to(`team:${activity.teamId}`).emit('activity:new', payload);
}

/**
 * Broadcast an agent status change.
 */
function broadcastAgentStatus(agent) {
 if (!io) return;
 io.to(`agent:${agent.id}`).emit('agent:status', {
 agentId: agent.id,
 status: agent.status,
 updatedAt: agent.updatedAt,
 });
 // Also publish to the parent team channel if known
 if (agent.member?.teamId) {
 io.to(`team:${agent.member.teamId}`).emit('agent:status', {
 agentId: agent.id,
 status: agent.status,
 updatedAt: agent.updatedAt,
 });
 }
}

/**
 * Broadcast a task update (status change, PR opened, etc.).
 */
function broadcastTaskUpdate(task) {
 if (!io) return;
 const payload = {
 id: task.id,
 status: task.status,
 assigneeId: task.assigneeId,
 agentId: task.agentId,
 branch: task.branch,
 prNumber: task.prNumber,
 updatedAt: task.updatedAt,
 };
 if (task.teamId) io.to(`team:${task.teamId}`).emit('task:updated', payload);
 io.to(`task:${task.id}`).emit('task:updated', payload);
}

module.exports = {
 initSocketServer,
 getIO,
 broadcastActivity,
 broadcastAgentStatus,
 broadcastTaskUpdate,
};
