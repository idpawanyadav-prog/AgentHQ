// ─── Realtime facade ──────────────────────────────────────────────────────────
// Used by the durable worker and future services to publish state changes.
// Express routes publish directly via server/socket/index.js; this module
// provides the same semantics for non-JS callers.

type Listener = (...args: any[]) => void;

const channels: Record<string, Set<Listener>> = {};

function on(channel: string, fn: Listener) {
 if (!channels[channel]) channels[channel] = new Set();
 channels[channel].add(fn);
 return () => { channels[channel]?.delete(fn); };
}

function emit(channel: string, ...args: any[]) {
 channels[channel]?.forEach((fn) => { try { fn(...args); } catch { /* ignore listener errors */ } });
}

// ─── Typed event helpers ────────────────────────────────────────────────────

export function onTaskUpdated(fn: (task: { id: string; status: string; teamId?: string | null }) => void) {
 return on('task:updated', fn);
}

export function onActivityNew(fn: (activity: { id: string; teamId: string; type: string }) => void) {
 return on('activity:new', fn);
}

export function onAgentStatus(fn: (data: { agentId: string; status: string }) => void) {
 return on('agent:status', fn);
}

export function onJobUpdated(fn: (data: { jobId: string; status: string }) => void) {
 return on('job:updated', fn);
}

// ─── Worker-side publisher ──────────────────────────────────────────────────
// Bridge between this module's internal channel system and the Socket.IO server.

export function wireUpSocketBridge(io: any) {
 io.on('connection', (socket: any) => {
 socket.join('admin');

 on('task:updated', (task) => {
 socket.to('admin').emit('task:updated', task);
 if (task.teamId) socket.to(`team:${task.teamId}`).emit('task:updated', task);
 });
 on('activity:new', (activity) => {
 socket.to('admin').emit('activity:new', activity);
 if (activity.teamId) socket.to(`team:${activity.teamId}`).emit('activity:new', activity);
 });
 on('agent:status', (data) => { socket.to('admin').emit('agent:status', data); });
 on('job:updated', (data) => { socket.to('admin').emit('job:updated', data); });
 });
}

export function publishActivity(activity: { id: string; teamId: string; type: string; description?: string }) {
 emit('activity:new', activity);
}

export function publishAgentStatus(data: { agentId: string; status: string; teamId?: string | null }) {
 emit('agent:status', data);
}

export function publishTaskUpdate(task: { id: string; status: string; teamId?: string | null }) {
 emit('task:updated', task);
}

