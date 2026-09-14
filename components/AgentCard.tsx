import React from "react";
import type { Agent, AgentStatus } from "../types";
import { FaMicrochip } from "react-icons/fa";

interface AgentCardProps {
	agent: Agent;
	onClick?: () => void;
	compact?: boolean;
}

const STATUS_CONFIG: Record<AgentStatus, { label: string; dotColor: string; badgeBg: string; badgeColor: string }> = {
	idle: {
		label: "Idle",
		dotColor: "#94a3b8",
		badgeBg: "rgba(100, 116, 139, 0.1)",
		badgeColor: "#94a3b8",
	},
	working: {
		label: "Working",
		dotColor: "#22c55e",
		badgeBg: "rgba(34, 197, 94, 0.1)",
		badgeColor: "#22c55e",
	},
	error: {
		label: "Error",
		dotColor: "#ef4444",
		badgeBg: "rgba(239, 68, 68, 0.1)",
		badgeColor: "#ef4444",
	},
};

const PROVIDER_STYLES: Record<string, { badge: string; iconBg: string }> = {
	anthropic: { badge: "model-badge-anthropic", iconBg: "#a855f7" },
	openai: { badge: "model-badge-openai", iconBg: "#3b82f6" },
};

const AgentCard: React.FC<AgentCardProps> = ({ agent, onClick, compact = false }) => {
	const status = STATUS_CONFIG[agent.status] ?? STATUS_CONFIG.idle;
	const providerStyle = PROVIDER_STYLES[agent.type] ?? PROVIDER_STYLES.anthropic;

	const stats = {
		tasksCompleted: (agent.tasks || []).filter((t) => t.status === "done").length,
		prsOpened: new Set((agent.tasks || []).filter((t) => t.prNumber != null).map((t) => t.prNumber)).size,
		avgTaskTime: "Unavailable" as const,
	};

	const getInitials = (name: string) => {
		const parts = name.split(" ");
		return parts.map((p) => p[0]).join("").toUpperCase().slice(0, 2);
	};

	if (compact) {
		return (
			<div
				onClick={onClick}
				className="agent-card team-card-compact flex items-center gap-3"
			>
				<div
					className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
					style={{ backgroundColor: providerStyle.iconBg }}
				>
					<FaMicrochip className="w-4 h-4 text-white" />
				</div>
				<div className="flex-1 min-w-0">
					<p className="text-sm font-medium truncate" style={{ color: "var(--text-primary)" }}>
						{agent.name}
					</p>
					<p className="text-xs truncate" style={{ color: "var(--text-tertiary)" }}>
						{agent.model} &middot; {status.label}
					</p>
				</div>
				<span
					className="text-[11px] px-2 py-0.5 rounded-full font-medium"
					style={{ backgroundColor: status.badgeBg, color: status.badgeColor }}
				>
					{status.label}
				</span>
			</div>
		);
	}

	return (
		<div onClick={onClick} className="agent-card">
			{/* Header: Avatar + Name + Status */}
			<div className="flex items-start gap-4 mb-4">
				<div
					className="w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0"
					style={{ backgroundColor: providerStyle.iconBg }}
				>
					<FaMicrochip className="w-6 h-6 text-white" />
				</div>
				<div className="flex-1 min-w-0">
					<div className="flex items-center gap-2 mb-1">
						<h3 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>
							{agent.name}
						</h3>
						<span
							className="inline-flex items-center gap-1.5 text-[11px] px-2 py-0.5 rounded-full font-medium"
							style={{ backgroundColor: status.badgeBg, color: status.badgeColor }}
						>
							<span className="w-1.5 h-1.5 rounded-full animate-pulse-dot" style={{ backgroundColor: status.dotColor }} />
							{status.label}
						</span>
					</div>
					<p className="text-sm" style={{ color: "var(--text-secondary)" }}>{agent.model}</p>
					<span className={"text-xs " + providerStyle.badge}>{agent.type} provider</span>
				</div>
			</div>

			{/* Config */}
			<div className="config-panel mb-4">
				<h4 className="text-xs font-medium mb-2" style={{ color: "var(--text-secondary)" }}>Configuration</h4>
				<div className="grid grid-cols-2 gap-2 text-xs">
					<div>
						<span style={{ color: "var(--text-tertiary)" }}>Temperature</span>
						<p className="font-medium" style={{ color: "var(--text-primary)" }}>{agent.config.temperature ?? 0.7}</p>
					</div>
					<div>
						<span style={{ color: "var(--text-tertiary)" }}>Max Tokens</span>
						<p className="font-medium" style={{ color: "var(--text-primary)" }}>{agent.config.maxTokens ?? 4096}</p>
					</div>
				</div>
				{agent.config.systemPrompt && (
					<div className="mt-2">
						<p className="text-xs line-clamp-2" style={{ color: "var(--text-secondary)" }}>{agent.config.systemPrompt}</p>
					</div>
				)}
			</div>

			{/* Stats */}
			<div className="grid grid-cols-3 gap-3">
				<div className="text-center">
					<p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.tasksCompleted}</p>
					<p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Completed</p>
				</div>
				<div className="text-center">
					<p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.prsOpened}</p>
					<p className="text-xs" style={{ color: "var(--text-tertiary)" }}>PRs Opened</p>
				</div>
				<div className="text-center">
					<p className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{stats.avgTaskTime}</p>
					<p className="text-xs" style={{ color: "var(--text-tertiary)" }}>Avg Time</p>
				</div>
			</div>
		</div>
	);
};

export default AgentCard;
