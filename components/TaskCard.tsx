import React from "react";
import type { TaskWithCI, TaskPriority, TaskStatus } from "../types";
import { FaExclamationCircle, FaClock, FaCodeBranch, FaMicrochip, FaUsers } from "react-icons/fa";

interface TaskCardProps {
 task: TaskWithCI;
 onClick?: () => void;
 showAssignee?: boolean;
 compact?: boolean;
}

const PRIORITY_STYLES: Record<TaskPriority, { color: string; label: string }> = {
 low: { color: "text-slate-400", label: "Low" },
 medium: { color: "text-yellow-400", label: "Medium" },
 high: { color: "text-orange-400", label: "High" },
 critical: { color: "text-red-400", label: "Critical" },
};

const STATUS_STYLES: Record<TaskStatus, { label: string; bg: string; text: string }> = {
 ready: { label: "Ready", bg: "bg-blue-400/10", text: "text-blue-400" },
 testing: { label: "Testing", bg: "bg-yellow-400/10", text: "text-yellow-400" },
 blocked: { label: "Blocked", bg: "bg-red-400/10", text: "text-red-400" },
 backlog: { label: "Backlog", bg: "bg-slate-600/20", text: "text-slate-400" },
 in_progress: { label: "In Progress", bg: "bg-blue-400/10", text: "text-blue-400" },
 review: { label: "Review", bg: "bg-yellow-400/10", text: "text-yellow-400" },
 done: { label: "Done", bg: "bg-green-400/10", text: "text-green-400" },
};

const TaskCard: React.FC<TaskCardProps> = ({
 task,
 onClick,
 showAssignee = true,
 compact = false,
}) => {
 const priorityStyle = PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES.medium;
 const statusStyle = STATUS_STYLES[task.status] ?? STATUS_STYLES.backlog;
 const assignee = task.assignee;

 const getAssigneeColor = (name: string) => {
 const colors = [
 "bg-blue-600",
 "bg-purple-600",
 "bg-green-600",
 "bg-orange-600",
 "bg-pink-600",
 "bg-cyan-600",
 ];
 let hash = 0;
 for (let i = 0; i < name.length; i++) {
 hash = name.charCodeAt(i) + ((hash << 5) - hash);
 }
 return colors[Math.abs(hash) % colors.length];
 };

 const getInitials = (name: string) => {
 const parts = name.split(" ");
 return parts
 .map((p) => p[0])
 .join("")
 .toUpperCase()
 .slice(0, 2);
 };

 const formatDate = (dateStr: string) => {
 const date = new Date(dateStr);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
 if (diffHours < 1) return "Just now";
 if (diffHours < 24) return `${diffHours}h ago`;
 const diffDays = Math.floor(diffHours / 24);
 return `${diffDays}d ago`;
 };

 if (compact) {
 return (
 <div
 onClick={onClick}
 className="task-card cursor-pointer"
 >
 <div className="flex items-start justify-between gap-2">
 <div className="flex-1 min-w-0">
 <p className="text-sm text-white font-medium truncate">
 {task.title}
 </p>
 {task.description && (
 <p className="text-xs text-slate-400 truncate mt-0.5">
 {task.description}
 </p>
 )}
 </div>
 <span className={`text-[11px] px-1.5 py-0.5 rounded ${priorityStyle.color} bg-slate-800 flex-shrink-0`}>
 {priorityStyle.label}
 </span>
 </div>
 <div className="flex items-center gap-2 mt-2">
 {task.prNumber && (
 <span className="flex items-center gap-1 text-xs text-slate-400">
 <FaCodeBranch className="w-3 h-3" />
 #{task.prNumber}
 </span>
 )}
 {task.ciStatus && (
 <span
 className={`text-xs px-1.5 py-0.5 rounded ${
 task.ciStatus.state === "success"
 ? "ci-success"
 : task.ciStatus.state === "failure"
 ? "ci-failure"
 : "ci-pending"
 }`}
 >
 {task.ciStatus.state === "success"
 ? "Passing"
 : task.ciStatus.state === "failure"
 ? "Failing"
 : "Pending"}
 </span>
 )}
 <span className="text-xs text-slate-600 ml-auto">
 {formatDate(task.createdAt)}
 </span>
 </div>
 </div>
 );
 }

 return (
 <div onClick={onClick} className="task-card">
 {/* Priority badge */}
 <div className="flex items-center justify-between mb-2">
 <span
 className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${
 priorityStyle.color
 } bg-slate-800/80`}
 >
 {priorityStyle.label}
 </span>
 <span
 className={`text-[11px] px-2 py-0.5 rounded-full font-medium ${statusStyle.bg} ${statusStyle.text}`}
 >
 {statusStyle.label}
 </span>
 </div>

 {/* Title & Description */}
 <h4 className="text-sm font-medium text-white mb-1 leading-snug">
 {task.title}
 </h4>
 {task.description && (
 <p className="text-xs text-slate-400 mb-3 line-clamp-2 leading-relaxed">
 {task.description}
 </p>
 )}

 {/* CI / PR info */}
 <div className="flex items-center gap-2 mb-3 flex-wrap">
 {task.prNumber && (
 <span className="flex items-center gap-1 text-xs text-slate-400 bg-slate-800 px-2 py-1 rounded">
 <FaCodeBranch className="w-3 h-3" />
 #{task.prNumber}
 </span>
 )}
 {task.branch && (
 <span className="text-xs text-slate-500 bg-slate-800/50 px-2 py-1 rounded">
 {task.branch}
 </span>
 )}
 {task.ciStatus && (
 <span
 className={`text-xs px-2 py-1 rounded ${
 task.ciStatus.state === "success"
 ? "ci-success"
 : task.ciStatus.state === "failure"
 ? "ci-failure"
 : "ci-pending"
 }`}
 >
 {task.ciStatus.state === "success"
 ? "CI Passing"
 : task.ciStatus.state === "failure"
 ? "CI Failing"
 : "CI Pending"}
 </span>
 )}
 </div>

 {/* Footer: assignee + time */}
 <div className="flex items-center justify-between pt-2 border-t border-slate-700/50">
 {showAssignee && (
 <div className="flex items-center gap-2">
 {assignee ? (
 <>
 <div
 className={`w-6 h-6 rounded-full ${getAssigneeColor(
 assignee.name
 )} flex items-center justify-center text-white text-[10px] font-bold`}
 >
 {getInitials(assignee.name)}
 </div>
 <span className="text-xs text-slate-400">{assignee.name}</span>
 </>
 ) : task.agent ? (
 <>
 <div className="w-6 h-6 rounded-full bg-purple-600 flex items-center justify-center">
 <FaMicrochip className="w-3 h-3 text-white" />
 </div>
 <span className="text-xs text-purple-400">{task.agent.name}</span>
 </>
 ) : (
 <>
 <div className="w-6 h-6 rounded-full bg-slate-700 flex items-center justify-center">
 <FaUsers className="w-3 h-3 text-slate-400" />
 </div>
 <span className="text-xs text-slate-500">Unassigned</span>
 </>
 )}
 </div>
 )}
 <div className="flex items-center gap-1 text-xs text-slate-500">
 <FaClock className="w-3 h-3" />
 {formatDate(task.createdAt)}
 </div>
 </div>
 </div>
 );
};

export default TaskCard;
