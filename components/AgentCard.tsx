import React from "react";
import type { Agent, AgentStatus } from "../types";
import { FaMicrochip } from "react-icons/fa";

interface AgentCardProps {
 agent: Agent;
 onClick?: () => void;
 compact?: boolean;
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; color: string; dot: string }> = {
 idle: {
 label: "Idle",
 color: "text-slate-400",
 dot: "bg-slate-400",
 },
 working: {
 label: "Working",
 color: "text-green-400",
 dot: "bg-green-400 animate-pulse-dot",
 },
 error: {
 label: "Error",
 color: "text-red-400",
 dot: "bg-red-400",
 },
};

interface AgentStats {
 tasksCompleted: number;
 prsOpened: number;
 avgTaskTime: string;
}

const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick, compact = false }) => {
 const status = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.idle;
 const stats: AgentStats = {
 tasksCompleted: (agent.tasks || []).filter(t => t.status === 'done').length,
 prsOpened: new Set((agent.tasks || []).filter(t => t.prNumber != null).map(t => t.prNumber)).size,
 avgTaskTime: "Unavailable",
 };

 const getProviderColor = () => {
 return agent.type === "anthropic" ? "text-purple-400" : "text-blue-400";
 };

 const getProviderBg = () => {
 return agent.type === "anthropic" ? "bg-purple-600" : "bg-blue-600";
 };

 const getInitials = (name: string) => {
 const parts = name.split(" ");
 return parts
 .map((p) => p[0])
 .join("")
 .toUpperCase()
 .slice(0, 2);
 };

 if (compact) {
 return (
 <div
 onClick={onClick}
 className="task-card flex items-center gap-3"
 >
 <div
 className={`w-8 h-8 rounded-full ${getProviderBg()} flex items-center justify-center flex-shrink-0`}
 >
 <FaMicrochip className="w-4 h-4 text-white" />
 </div>
 <div className="flex-1 min-w-0">
 <p className="text-sm text-white font-medium truncate">{agent.name}</p>
 <p className="text-xs text-slate-400 truncate">
 {agent.model} · {status.label}
 </p>
 </div>
 <span
 className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
 status.color === "text-green-400"
 ? "bg-green-400/10 text-green-400"
 : status.color === "text-red-400"
 ? "bg-red-400/10 text-red-400"
 : "bg-slate-700 text-slate-400"
 }`}
 >
 {status.label}
 </span>
 </div>
 );
 }

 return (
 <div onClick={onClick} className="team-card">
 <div className="flex items-start gap-4 mb-4">
 {/* Avatar */}
 <div
 className={`w-12 h-12 rounded-full ${getProviderBg()} flex items-center justify-center flex-shrink-0`}
 >
 <FaMicrochip className="w-6 h-6 text-white" />
 </div>

 <div className="flex-1 min-w-0">
 <div className="flex items-center gap-2 mb-1">
 <h3 className="text-base font-semibold text-white truncate">
 {agent.name}
 </h3>
 <span
 className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full ${
 status.color === "text-green-400"
 ? "bg-green-400/10 text-green-400"
 : status.color === "text-red-400"
 ? "bg-red-400/10 text-red-400"
 : "bg-slate-700 text-slate-400"
 }`}
 >
 <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
 {status.label}
 </span>
 </div>
 <p className="text-sm text-slate-400">{agent.model}</p>
 <p className="text-xs text-slate-500 capitalize">
 {agent.type} provider
 </p>
 </div>
 </div>

 {/* Config */}
 <div className="bg-slate-900/50 rounded-lg p-3 mb-4">
 <h4 className="text-xs font-medium text-slate-400 mb-2">
 Configuration
 </h4>
 <div className="grid grid-cols-2 gap-2 text-xs">
 <div>
 <span className="text-slate-500">Temperature</span>
 <p className="text-slate-300">
 {agent.config.temperature ?? 0.7}
 </p>
 </div>
 <div>
 <span className="text-slate-500">Max Tokens</span>
 <p className="text-slate-300">
 {agent.config.maxTokens ?? 4096}
 </p>
 </div>
 </div>
 {agent.config.systemPrompt && (
 <div className="mt-2">
 <span className="text-slate-500 text-xs"></span>
 <p className="text-xs text-slate-400 mt-0.5 line-clamp-2">
 {agent.config.systemPrompt}
 </p>
 </div>
 )}
 </div>

 {/* Stats */}
 <div className="grid grid-cols-3 gap-3">
 <div className="text-center">
 <p className="text-lg font-bold text-white">
 {stats.tasksCompleted}
 </p>
 <p className="text-xs text-slate-500">Completed</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-bold text-white">{stats.prsOpened}</p>
 <p className="text-xs text-slate-500">PRs Opened</p>
 </div>
 <div className="text-center">
 <p className="text-lg font-bold text-white">
 {stats.avgTaskTime}
 </p>
 <p className="text-xs text-slate-500">Avg Time</p>
 </div>
 </div>
 </div>
 );
};

export default AgentCard;
