// ─── Shared realtime event layer ─────────────────────────────────────────────
// All mutation paths publish state changes through this module.
// Socket.IO listeners subscribe to these events in server/socket/index.js.

type EventHandler = (...args: any[]) => void;

const channels: Record<string, Set<EventHandler>> = {};

function on(channel: string, fn: EventHandler) {
 if (!channels[channel]) channels[channel] = new Set();
 channels[channel].add(fn);
 return () => { channels[channel]?.delete(fn); };
}

function emit(channel: string, ...args: any[]) {
 channels[channel]?.forEach((fn) => { try { fn(...args); } catch { /* ignore listener errors */ } });
}

// ─── Named event helpers ────────────────────────────────────────────────────

export function emitTaskUpdate(task: { id: string; status?: string; assigneeId?: string | null; agentId?: string | null }) {
 emit('task:updated', task);
}

export function emitActivity(activity: { id: string; teamId?: string; type?: string; description?: string }) {
 emit('activity:new', activity);
}

export function emitAgentStatus(data: { agentId: string; status: string }) {
 emit('agent:status', data);
}

export function emitJobUpdate(data: { jobId: string; status: string; error?: string | null }) {
 emit('job:updated', data);
}

// ─── Socket.IO subscriber (called once from server/socket/index.js) ─────────

export function subscribeSocket(io: any) {
 io.on('connection', (socket: any) => {
 socket.on('join:team', (teamId: string) => { socket.join(`team:${teamId}`); });
 socket.on('leave:team', (teamId: string) => { socket.leave(`team:${teamId}`); });
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

