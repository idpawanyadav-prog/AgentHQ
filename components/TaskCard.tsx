import React from "react";
import type { TaskWithCI, TaskPriority, TaskStatus } from "../types";
import { FaExclamationCircle, FaClock, FaCodeBranch, FaMicrochip, FaUsers } from "react-icons/fa";

interface TaskCardProps {
	task: TaskWithCI;
	onClick?: () => void;
	showAssignee?: boolean;
	compact?: boolean;
}

const PRIORITY_CLASSES: Record<TaskPriority, string> = {
	low: "priority-low",
	medium: "priority-medium",
	high: "priority-high",
	critical: "priority-critical",
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

const STATUS_CLASSES: Record<TaskStatus, { badge: string; label: string }> = {
	ready: { badge: "ci-pending", label: "Ready" },
	testing: { badge: "ci-pending", label: "Testing" },
	blocked: { badge: "ci-failure", label: "Blocked" },
	backlog: { badge: "ci-pending", label: "Backlog" },
	in_progress: { badge: "ci-success", label: "In Progress" },
	review: { badge: "ci-pending", label: "Review" },
	done: { badge: "ci-success", label: "Done" },
};

const TASK_TYPE_COLORS: Record<string, string> = {
	task: "#3b82f6",
	bug: "#ef4444",
	feature: "#22c55e",
	chore: "#94a3b8",
};

const TaskCard: React.FC<TaskCardProps> = ({
	task,
	onClick,
	showAssignee = true,
	compact = false,
}) => {
	const priorityClass = PRIORITY_CLASSES[task.priority] ?? PRIORITY_CLASSES.medium;
	const priorityLabel = PRIORITY_LABELS[task.priority] ?? "Medium";
	const statusStyle = STATUS_CLASSES[task.status] ?? STATUS_CLASSES.backlog;
	const assignee = task.assignee;

	const getAssigneeColor = (name: string) => {
		const colors = ["#3b82f6", "#8b5cf6", "#22c55e", "#f97316", "#ec4899", "#06b6d4"];
		let hash = 0;
		for (let i = 0; i < name.length; i++) {
			hash = name.charCodeAt(i) + ((hash << 5) - hash);
		}
		return colors[Math.abs(hash) % colors.length];
	};

	const getInitials = (name: string) => {
		const parts = name.split(" ");
		return parts.map((p) => p[0]).join("").toUpperCase().slice(0, 2);
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
			<div onClick={onClick} className="task-card team-card-compact">
				<div className="flex items-start justify-between gap-2">
					<div className="flex-1 min-w-0">
						<div className="flex items-center gap-2">
							<div className="drag-indicator flex-shrink-0 opacity-50 hover:opacity-100 transition-colors">
								<div className="drag-indicator-dot"><span></span><span></span><span></span></div>
							</div>
							<p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>{task.title}</p>
						</div>
						{task.description && (
							<p className="text-xs truncate mt-0.5 ml-7" style={{ color: "var(--text-secondary)" }}>{task.description}</p>
						)}
					</div>
					<span className={"priority-badge " + priorityClass + " flex-shrink-0"}>{priorityLabel}</span>
				</div>
				<div className="flex items-center gap-2 mt-2 ml-7">
					{task.prNumber && (
						<span className="flex items-center gap-1 text-xs" style={{ color: "var(--text-secondary)" }}>
							<FaCodeBranch className="w-3 h-3" />#{task.prNumber}
						</span>
					)}
					{task.ciStatus && (
						<span className={"text-xs " + (task.ciStatus.state === "success" ? "ci-success" : task.ciStatus.state === "failure" ? "ci-failure" : "ci-pending")}>
							{task.ciStatus.state === "success" ? "Passing" : task.ciStatus.state === "failure" ? "Failing" : "Pending"}
						</span>
					)}
					{task.blocked && <span className="blocked-indicator">Blocked</span>}
					<span className="text-xs ml-auto" style={{ color: "var(--text-tertiary)" }}>{formatDate(task.createdAt)}</span>
				</div>
			</div>
		);
	}

	return (
		<div onClick={onClick} className="task-card">
			{/* Priority + Status badges */}
			<div className="flex items-center justify-between mb-2">
				<span className={"priority-badge " + priorityClass}>{priorityLabel}</span>
				<span className={"text-[11px] px-2 py-0.5 rounded-full font-medium " + statusStyle.badge}>{statusStyle.label}</span>
			</div>

			{/* Title & Description */}
			<h4 className="text-sm font-medium mb-1 leading-snug" style={{ color: "var(--text-primary)" }}>{task.title}</h4>
			{task.description && (
				<p className="text-xs mb-3 line-clamp-2 leading-relaxed" style={{ color: "var(--text-secondary)" }}>{task.description}</p>
			)}

			{/* Type tag + CI / PR info */}
			<div className="flex items-center gap-2 mb-3 flex-wrap">
				{task.prNumber && (
					<span className="flex items-center gap-1 text-xs tag-chip">
						<FaCodeBranch className="w-3 h-3" />#{task.prNumber}
					</span>
				)}
				{task.branch && <span className="tag-chip" style={{ backgroundColor: "var(--bg-tertiary)", color: "var(--text-tertiary)" }}>{task.branch}</span>}
				{task.ciStatus && (
					<span className={"text-xs px-2 py-1 rounded " + (task.ciStatus.state === "success" ? "ci-success" : task.ciStatus.state === "failure" ? "ci-failure" : "ci-pending")}>
						{task.ciStatus.state === "success" ? "CI Passing" : task.ciStatus.state === "failure" ? "CI Failing" : "CI Pending"}
					</span>
				)}
				{task.blocked && <span className="blocked-indicator">Blocked</span>}
			</div>

			{/* Footer: assignee + time */}
			<div className="flex items-center justify-between pt-2" style={{ borderTop: "1px solid var(--border-default)" }}>
				{showAssignee && (
					<div className="flex items-center gap-2">
						{assignee ? (
							<>
								<div className="member-avatar" style={{ backgroundColor: getAssigneeColor(assignee.name) }}>{getInitials(assignee.name)}</div>
								<span className="text-xs" style={{ color: "var(--text-secondary)" }}>{assignee.name}</span>
							</>
						) : task.agent ? (
							<>
								<div className="member-avatar" style={{ backgroundColor: "#a855f7" }}>
									<FaMicrochip className="w-3 h-3 text-white" />
								</div>
								<span className="text-xs" style={{ color: "#a855f7" }}>{task.agent.name}</span>
							</>
						) : (
							<>
								<div className="member-avatar" style={{ backgroundColor: "#475569" }}>
									<FaUsers className="w-3 h-3" style={{ color: "#94a3b8" }} />
								</div>
								<span className="text-xs" style={{ color: "var(--text-tertiary)" }}>Unassigned</span>
							</>
						)}
					</div>
				)}
				<div className="flex items-center gap-1 text-xs" style={{ color: "var(--text-tertiary)" }}>
					<FaClock className="w-3 h-3" />
					{formatDate(task.createdAt)}
				</div>
			</div>
		</div>
	);
};

export default TaskCard;
