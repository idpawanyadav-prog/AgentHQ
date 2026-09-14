import { io, type Socket } from "socket.io-client";
import type {
 ServerToClientEvents,
 ClientToServerEvents,
 Activity,
 Task,
 AgentStatus,
 CIStatus,
} from "../types";

let socket: Socket<ServerToClientEvents, ClientToServerEvents> | null = null;

const SOCKET_URL =
 process.env.NEXT_PUBLIC_SOCKET_URL ?? "http://localhost:4000";

export function getSocket(): Socket<
 ServerToClientEvents,
 ClientToServerEvents
> {
 if (!socket) {
 socket = io(SOCKET_URL, {
 autoConnect: true,
 withCredentials: true,
 transports: ["websocket", "polling"],
 });

 socket.on("connect_error", (err) => {
 console.warn("[Socket] Connection failed:", err.message);
 });
 }

 return socket;
}

export function subscribeToTeam(teamId: string) {
 const s = getSocket();
 s.emit("join:team", teamId);
}

export function unsubscribeFromTeam(teamId: string) {
 const s = getSocket();
 s.emit("leave:team", teamId);
}

// ─── Typed event listeners ───────────────────────────────────────────

type Listener<T> = (data: T) => void;

const listenerMap = new Map<string, Set<Listener<unknown>>>();

export function onActivityNew(fn: (activity: Activity) => void) {
 const s = getSocket();
 s.on("activity:new", fn as Listener<Activity>);
 return () => {
 s.off("activity:new", fn as Listener<Activity>);
 };
}

export function onAgentStatus(
 fn: (data: { agentId: string; status: AgentStatus }) => void
) {
 const s = getSocket();
 s.on("agent:status", fn);
 return () => {
 s.off("agent:status", fn);
 };
}

export function onTaskUpdated(fn: (task: Task) => void) {
 const s = getSocket();
 s.on("task:updated", fn as Listener<Task>);
 return () => {
 s.off("task:updated", fn as Listener<Task>);
 };
}

export function onCIUpdate(fn: (data: { taskId: string; ciStatus: CIStatus }) => void) {
 const s = getSocket();
 s.on("ci:update", fn);
 return () => {
 s.off("ci:update", fn);
 };
}

// ─── Internal bookkeeping ────────────────────────────────────────────


export function onDashboardChange(refresh:()=>void) {
 const socket=getSocket();
 socket.on('connect',refresh);
 socket.on('data:changed',refresh);
 return ()=>{socket.off('connect',refresh);socket.off('data:changed',refresh);};
}
