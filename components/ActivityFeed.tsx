import React, { useEffect, useState, useCallback } from "react";
import type { Activity } from "../types";
import {
 FaCheckSquare,
 FaCodeBranch,
 FaCheckCircle,
 FaTimesCircle,
 FaExclamationTriangle,
 FaPlay,
 FaUserPlus,
 FaFlag,
 FaSpinner,
} from "react-icons/fa";

interface ActivityFeedProps {
 activities: Activity[];
 live?: boolean;
 onLiveChange?: (live: boolean) => void;
 title?: string;
 maxHeight?: string;
}

const ACTIVITY_ICONS: Record<string, React.ReactNode> = {
 task_assigned: <FaUserPlus className="w-4 h-4 text-blue-400" />,
 task_moved: <FaFlag className="w-4 h-4 text-purple-400" />,
 commit: <FaCheckSquare className="w-4 h-4 text-slate-400" />,
 pr_opened: <FaCodeBranch className="w-4 h-4 text-green-400" />,
 pr_merged: <FaCheckCircle className="w-4 h-4 text-green-500" />,
 pr_closed: <FaTimesCircle className="w-4 h-4 text-red-400" />,
 ci_passed: <FaCheckCircle className="w-4 h-4 text-green-400" />,
 ci_failed: <FaTimesCircle className="w-4 h-4 text-red-400" />,
 agent_started: <FaPlay className="w-4 h-4 text-blue-400" />,
 agent_completed: <FaCheckSquare className="w-4 h-4 text-green-500" />,
 agent_error: <FaExclamationTriangle className="w-4 h-4 text-red-400" />,
 team_created: <FaUserPlus className="w-4 h-4 text-purple-400" />,
 member_added: <FaUserPlus className="w-4 h-4 text-blue-400" />,
 milestone_completed: <FaCheckSquare className="w-4 h-4 text-yellow-400" />,
};

const ACTIVITY_COLORS: Record<string, string> = {
 task_assigned: "bg-blue-400",
 task_moved: "bg-purple-400",
 commit: "bg-slate-400",
 pr_opened: "bg-green-400",
 pr_merged: "bg-green-500",
 pr_closed: "bg-red-400",
 ci_passed: "bg-green-400",
 ci_failed: "bg-red-400",
 agent_started: "bg-blue-400",
 agent_completed: "bg-green-500",
 agent_error: "bg-red-400",
 team_created: "bg-purple-400",
 member_added: "bg-blue-400",
 milestone_completed: "bg-yellow-400",
};

const ActivityFeed: React.FC<ActivityFeedProps> = ({
 activities,
 live = false,
 onLiveChange,
 title = "Live Activity",
 maxHeight = "500px",
}) => {
 const isLive = live;

 const formatTime = useCallback((dateStr: string) => {
 const date = new Date(dateStr);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffSecs = Math.floor(diffMs / 1000);
 const diffMins = Math.floor(diffSecs / 60);
 const diffHours = Math.floor(diffMins / 60);

 if (diffSecs < 10) return "Just now";
 if (diffSecs < 60) return `${diffSecs}s ago`;
 if (diffMins < 60) return `${diffMins}m ago`;
 if (diffHours < 24) return `${diffHours}h ago`;
 return date.toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 hour: "2-digit",
 minute: "2-digit",
 });
 }, []);

 const getMetaLabel = (activity: Activity): string => {
 if (!activity.meta) return "";
 const parts: string[] = [];
 if (activity.meta.prNumber) parts.push(`#${activity.meta.prNumber}`);
 if (activity.meta.branch) parts.push(activity.meta.branch);
 if (activity.meta.tokensUsed) parts.push(`${activity.meta.tokensUsed} tokens`);
 if (activity.meta.ciState) parts.push(`CI: ${activity.meta.ciState}`);
 return parts.join(" · ");
 };

 return (
 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg overflow-hidden">
 {/* Header */}
 <div className="flex items-center justify-between px-4 py-3 border-b border-slate-700">
 <div className="flex items-center gap-2">
 <h3 className="text-sm font-semibold text-white">{title}</h3>
 {isLive && (
 <span className="flex items-center gap-1 text-xs text-green-400">
 <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse-dot" />
 Live
 </span>
 )}
 </div>
 <button
 disabled={!onLiveChange}
 onClick={() => onLiveChange?.(!isLive)}
 className={`text-xs px-2 py-1 rounded transition-colors ${
 isLive
 ? "bg-green-400/10 text-green-400 hover:bg-green-400/20"
 : "bg-slate-700 text-slate-400 hover:bg-slate-600"
 }`}
 >
 {isLive ? "Live · 2s" : onLiveChange ? "Paused" : "Snapshot"}
 </button>
 </div>

 {/* Activity list */}
 <div
 className="overflow-y-auto scrollbar-thin"
 style={{ maxHeight }}
 >
 {activities.length === 0 ? (
 <div className="text-center py-12 text-slate-500 text-sm">
 No activity yet
 </div>
 ) : (
 <div>
 {activities.map((activity) => (
 <div
 key={activity.id}
 className="activity-item animate-fade-in"
 >
 <div className="mt-0.5">
 {ACTIVITY_ICONS[activity.type] ?? (
 <div className="w-4 h-4 rounded-full bg-slate-600" />
 )}
 </div>
 <div className="flex-1 min-w-0">
 <div className="flex items-start justify-between gap-2">
 <p className="text-sm text-slate-300">{activity.description}</p>
 <span className="text-xs text-slate-500 flex-shrink-0 whitespace-nowrap">
 {formatTime(activity.createdAt)}
 </span>
 </div>
 {activity.meta && (
 <p className="text-xs text-slate-500 mt-0.5">
 {getMetaLabel(activity)}
 </p>
 )}
 {typeof activity.meta?.output === "string" && <details><summary className="cursor-pointer text-blue-400">View output</summary><pre className="whitespace-pre-wrap break-words text-sm p-3">{activity.meta.output}</pre></details>}
 </div>
 </div>
 ))}
 </div>
 )}
 </div>
 </div>
 );
};

export default ActivityFeed;
