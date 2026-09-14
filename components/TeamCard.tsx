import React from "react";
import type { Team } from "@/types";
import {
	FaTasks,
	FaCheckCircle,
	FaClock,
	FaCalendar,
	FaEllipsisH,
	FaUsers,
	FaArrowRight,
} from "react-icons/fa";

const COLOR_MAP: Record<string, { bg: string; text: string; progress: string }> = {
	blue: { bg: "#3b82f6", text: "text-[#3b82f6]", progress: "sprint-progress-fill-blue" },
	purple: { bg: "#a855f7", text: "text-[#a855f7]", progress: "sprint-progress-fill-purple" },
	orange: { bg: "#f97316", text: "text-[#f97316]", progress: "sprint-progress-fill-orange" },
	green: { bg: "#22c55e", text: "text-[#22c55e]", progress: "sprint-progress-fill-green" },
};

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
	active: { label: "Active", className: "status-badge-active" },
	paused: { label: "On Hold", className: "status-badge-paused" },
	archived: { label: "Archived", className: "status-badge-archived" },
};

const MODEL_COLORS: Record<string, string> = {
	Sonnet: "model-badge-openai",
	"Fable S.1": "model-badge-anthropic",
	"Opus 5": "model-badge-openai",
	Haiku: "model-badge-anthropic",
};

interface TeamCardProps {
	team: Team;
	onViewTeam?: () => void;
}

export default function TeamCard({ team, onViewTeam }: TeamCardProps) {
	const colors = COLOR_MAP[team.teamColor] || COLOR_MAP.blue;
	const sc = STATUS_CONFIG[team.status] || STATUS_CONFIG.active;

	const progressWidth = Math.min(team.sprintProgress, 100);
	const daysLabel = team.daysLeft === null ? "Not started" : `${team.daysLeft} days left`;

	const teamMembers = team.teamMembers || [];
	const memberCount = team.members.length > 0 ? team.members.length : teamMembers.length;

	return (
		<div className="team-card team-card-compact group">
			{/* Header row */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-3">
					<div
						className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold text-lg flex-shrink-0"
						style={{ backgroundColor: colors.bg }}
					>
						{team.letter}
					</div>
					<div className="min-w-0">
						<h3 className="font-semibold text-sm truncate" style={{ color: "var(--text-primary)" }}>
							{team.name}
						</h3>
						<p className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
							{team.description}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2 flex-shrink-0">
					<span className={"text-xs px-2 py-0.5 rounded-full " + sc.className}>{sc.label}</span>
					{onViewTeam && (
						<button
							onClick={onViewTeam}
							className="p-1 rounded transition-colors duration-150 opacity-60 hover:opacity-100"
							style={{ color: "var(--text-tertiary)" }}
						>
							<FaEllipsisH className="w-4 h-4" />
						</button>
					)}
				</div>
			</div>

			{/* Sprint progress row */}
			<div className="mb-3">
				<div className="flex items-center justify-between text-xs mb-1.5">
					<span style={{ color: "var(--text-secondary)" }}>Sprint {team.sprint} of {team.sprintOf}</span>
					<span className="text-xs" style={{ color: "var(--text-tertiary)" }}>{daysLabel}</span>
				</div>
				<div className="sprint-progress">
					<div className={"sprint-progress-fill " + colors.progress} style={{ width: `${progressWidth}%` }} />
				</div>
			</div>

			{/* Stats row */}
			<div className="flex items-center gap-4 mb-3 text-xs">
				<div className="team-footer-stat" style={{ color: "var(--text-secondary)" }}>
					<FaClock className="w-3 h-3" /><span>{team.activeSprints}</span>
				</div>
				<div className="team-footer-stat" style={{ color: "var(--text-secondary)" }}>
					<FaTasks className="w-3 h-3" /><span>{team.openTasks}</span>
				</div>
				<div className="team-footer-stat" style={{ color: "var(--text-secondary)" }}>
					<FaCheckCircle className="w-3 h-3" /><span>{team.completed}</span>
				</div>
				<div className="team-footer-stat ml-auto" style={{ color: "var(--text-tertiary)" }}>
					<span>Sprint</span>
					<span className={"font-medium " + colors.text}>{team.sprintProgress}%</span>
				</div>
			</div>

			{/* Members row */}
			<div className="mb-3">
				<p className="text-xs mb-2 flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
					<FaUsers className="w-3 h-3" />
					Team Members ({memberCount})
				</p>
				<div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
					{teamMembers.map((member, idx) => (
						<div key={idx} className="flex flex-col items-center flex-shrink-0">
							<div className="member-avatar" style={{ backgroundColor: "var(--bg-tertiary)" }}>{member.name.charAt(0)}</div>
							<span className="member-name mt-0.5 truncate" style={{ maxWidth: "40px" }}>{member.name.split(" ")[0]}</span>
							<span className={"model-badge " + (MODEL_COLORS[member.model] || "model-badge-openai")}>{member.model}</span>
						</div>
					))}
				</div>
			</div>

			{/* Footer row */}
			<div className="flex items-center justify-between pt-3" style={{ borderTop: "1px solid var(--border-default)" }}>
				<div className="flex items-center gap-3 text-xs" style={{ color: "var(--text-tertiary)" }}>
					<span>{team.features} Features</span>
					<span>{team.integrations} Integrations</span>
					<span>{team.issues} Issues</span>
					<span className="flex items-center gap-1"><FaCalendar className="w-3 h-3" />{team.dueDate}</span>
				</div>
				{onViewTeam && (
					<button
						onClick={onViewTeam}
						className="text-xs font-medium flex items-center gap-1 flex-shrink-0 transition-colors duration-150"
						style={{ color: "var(--accent)" }}
						onMouseEnter={(e) => { e.currentTarget.style.color = "var(--accent-hover)"; }}
						onMouseLeave={(e) => { e.currentTarget.style.color = "var(--accent)"; }}
					>
						View Team
						<FaArrowRight className="w-3 h-3" />
					</button>
				)}
			</div>
		</div>
	);
}
