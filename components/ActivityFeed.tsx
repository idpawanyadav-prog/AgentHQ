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
	task_assigned: <FaUserPlus className="w-4 h-4 text-[#3b82f6]" />,
	task_moved: <FaFlag className="w-4 h-4 text-[#a855f7]" />,
	commit: <FaCheckSquare className="w-4 h-4 text-[var(--text-secondary)]" />,
	pr_opened: <FaCodeBranch className="w-4 h-4 text-[#22c55e]" />,
	pr_merged: <FaCheckCircle className="w-4 h-4 text-[#22c55e]" />,
	pr_closed: <FaTimesCircle className="w-4 h-4 text-[#ef4444]" />,
	ci_passed: <FaCheckCircle className="w-4 h-4 text-[#22c55e]" />,
	ci_failed: <FaTimesCircle className="w-4 h-4 text-[#ef4444]" />,
	agent_started: <FaPlay className="w-4 h-4 text-[#3b82f6]" />,
	agent_completed: <FaCheckSquare className="w-4 h-4 text-[#22c55e]" />,
	agent_error: <FaExclamationTriangle className="w-4 h-4 text-[#ef4444]" />,
	team_created: <FaUserPlus className="w-4 h-4 text-[#a855f7]" />,
	member_added: <FaUserPlus className="w-4 h-4 text-[#3b82f6]" />,
	milestone_completed: <FaCheckSquare className="w-4 h-4 text-[#eab308]" />,
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
		return parts.join(" &middot; ");
	};

	return (
		<div className="page-panel">
			{/* Header */}
			<div className="flex items-center justify-between px-4 py-3 separator">
				<div className="flex items-center gap-2">
					<h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
					{isLive && (
						<span className="live-indicator text-xs" style={{ color: "var(--success)" }}>
							<span className="live-indicator-dot" />Live
						</span>
					)}
				</div>
				<button
					disabled={!onLiveChange}
					onClick={() => onLiveChange?.(!isLive)}
					className={"text-xs transition-colors duration-150 " + (onLiveChange ? "btn-secondary" : "")}
					style={!onLiveChange ? { padding: "0.25rem 0.5rem", borderRadius: "0.375rem", fontSize: "0.75rem", color: "var(--text-tertiary)" } : undefined}
				>
					{isLive ? "Live" : onLiveChange ? "Paused" : "Snapshot"}
				</button>
			</div>

			{/* Activity list */}
			<div className="overflow-y-auto scrollbar-thin" style={{ maxHeight }}>
				{activities.length === 0 ? (
					<div className="text-center py-12 text-sm" style={{ color: "var(--text-tertiary)" }}>
						No activity yet
					</div>
				) : (
					<div>
						{activities.map((activity) => (
							<div key={activity.id} className="activity-item animate-fade-in">
								<div className="mt-0.5">{ACTIVITY_ICONS[activity.type] ?? <div className="w-4 h-4 rounded-full bg-[var(--bg-tertiary)]" />}</div>
								<div className="flex-1 min-w-0">
									<div className="flex items-start justify-between gap-2">
										<p className="text-sm" style={{ color: "var(--text-primary)" }}>{activity.description}</p>
										<span className="text-xs flex-shrink-0 whitespace-nowrap" style={{ color: "var(--text-tertiary)" }}>{formatTime(activity.createdAt)}</span>
									</div>
									{activity.meta && (
										<p className="text-xs mt-0.5" style={{ color: "var(--text-tertiary)" }}>{getMetaLabel(activity)}</p>
									)}
									{typeof activity.meta?.output === "string" && (
										<>
											<div className="separator" />
											<details>
												<summary className="cursor-pointer text-sm transition-colors duration-150" style={{ color: "var(--accent)" }}>View output</summary>
												<pre className="whitespace-pre-wrap break-words text-sm p-3 mt-2 rounded-md" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-primary)" }}>{activity.meta.output}</pre>
											</details>
										</>
									)}
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
