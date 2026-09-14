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

const COLOR_MAP: Record<
	string,
	{ bg: string; text: string; light: string; progress: string }
> = {
	blue: {
		bg: "bg-blue-500",
		text: "text-blue-400",
		light: "bg-blue-400/10 text-blue-400",
		progress: "bg-blue-500",
	},
	purple: {
		bg: "bg-purple-500",
		text: "text-purple-400",
		light: "bg-purple-400/10 text-purple-400",
		progress: "bg-purple-500",
	},
	orange: {
		bg: "bg-orange-500",
		text: "text-orange-400",
		light: "bg-orange-400/10 text-orange-400",
		progress: "bg-orange-500",
	},
	green: {
		bg: "bg-green-500",
		text: "text-green-400",
		light: "bg-green-400/10 text-green-400",
		progress: "bg-green-500",
	},
};

const STATUS_CONFIG: Record<
	string,
	{ label: string; className: string }
> = {
	active: { label: "Active", className: "bg-green-400/10 text-green-400 border border-green-400/20" },
	paused: { label: "On Hold", className: "bg-yellow-400/10 text-yellow-400 border border-yellow-400/20" },
	archived: { label: "Archived", className: "bg-slate-400/10 text-slate-400 border border-slate-400/20" },
};

const MODEL_COLORS: Record<string, string> = {
	Sonnet: "bg-blue-400/10 text-blue-400",
	"Fable S.1": "bg-purple-400/10 text-purple-400",
	"Opus 5": "bg-green-400/10 text-green-400",
	Haiku: "bg-orange-400/10 text-orange-400",
};

interface TeamCardProps {
	team: Team;
	onViewTeam?: () => void;
}

export default function TeamCard({ team, onViewTeam }: TeamCardProps) {
	const colors = COLOR_MAP[team.teamColor] || COLOR_MAP.blue;
	const sc = STATUS_CONFIG[team.status] || STATUS_CONFIG.active;

	const progressWidth = Math.min(team.sprintProgress, 100);
	const daysLabel =
		team.daysLeft === null ? "Not started" : `${team.daysLeft} days left`;

	// Use teamMembers (the display list) for the member row
	const teamMembers = team.teamMembers || [];
	// Use members (full Member objects) for count, fallback to teamMembers
	const memberCount = team.members.length > 0
		? team.members.length
		: teamMembers.length;

	return (
		<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4 hover:border-slate-600 transition-colors">
			{/* Header row */}
			<div className="flex items-start justify-between mb-3">
				<div className="flex items-center gap-3">
					<div
						className={`w-10 h-10 rounded-lg ${colors.bg} flex items-center justify-center text-white font-bold text-lg flex-shrink-0`}
					>
						{team.letter}
					</div>
					<div className="min-w-0">
						<h3 className="text-white font-semibold text-sm truncate">
							{team.name}
						</h3>
						<p className="text-slate-400 text-xs truncate">
							{team.description}
						</p>
					</div>
				</div>
				<div className="flex items-center gap-2 flex-shrink-0">
					<span
						className={`text-[11px] px-2 py-0.5 rounded-full ${sc.className}`}
					>
						{sc.label}
					</span>
					<button className="text-slate-400 hover:text-slate-300 p-1 rounded hover:bg-slate-700/50 transition-colors">
						<FaEllipsisH className="w-4 h-4" />
					</button>
				</div>
			</div>

			{/* Sprint row */}
			<div className="mb-3">
				<div className="flex items-center justify-between text-xs mb-1">
					<span className="text-slate-400">
						Sprint {team.sprint} of {team.sprintOf}
					</span>
					<span
						className={
							team.daysLeft !== null && team.daysLeft > 0
								? "text-slate-400"
								: "text-slate-500"
						}
					>
						{daysLabel}
					</span>
				</div>
				<div className="w-full bg-slate-700 rounded-full h-1.5">
					<div
						className={`${colors.progress} h-1.5 rounded-full transition-all`}
						style={{ width: `${progressWidth}%` }}
					/>
				</div>
			</div>

			{/* Stats row */}
			<div className="flex items-center gap-4 mb-3 text-xs">
				<div className="flex items-center gap-1 text-slate-400">
					<FaClock className="w-3 h-3" />
					<span>{team.activeSprints}</span>
				</div>
				<div className="flex items-center gap-1 text-slate-400">
					<FaTasks className="w-3 h-3" />
					<span>{team.openTasks}</span>
				</div>
				<div className="flex items-center gap-1 text-slate-400">
					<FaCheckCircle className="w-3 h-3" />
					<span>{team.completed}</span>
				</div>
				<div className="flex items-center gap-1 text-slate-400">
					<span className="text-[10px] text-slate-500">Sprint</span>
					<span className={`${colors.text} font-medium`}>
						{team.sprintProgress}%
					</span>
				</div>
			</div>

			{/* Members row */}
			<div className="mb-3">
				<p className="text-xs text-slate-400 mb-2 flex items-center gap-1">
					<FaUsers className="w-3 h-3" />
					Team Members ({memberCount})
				</p>
				<div className="flex gap-2 overflow-x-auto scrollbar-thin pb-1">
					{teamMembers.map((member, idx) => (
						<div
							key={idx}
							className="flex flex-col items-center flex-shrink-0"
						>
							<div className="w-7 h-7 rounded-full bg-slate-600 flex items-center justify-center text-white text-[10px] font-medium">
								{member.name.charAt(0)}
							</div>
							<span className="text-[9px] text-slate-400 mt-0.5 truncate max-w-[40px]">
								{member.name.split(" ")[0]}
							</span>
							<span
								className={`text-[8px] px-1 rounded ${MODEL_COLORS[member.model] || "bg-slate-700/50 text-slate-500"}`}
							>
								{member.model}
							</span>
						</div>
					))}
				</div>
			</div>

			{/* Footer row */}
			<div className="flex items-center justify-between pt-3 border-t border-slate-700/50">
				<div className="flex items-center gap-3 text-xs text-slate-400">
					<span>{team.features} Features</span>
					<span>{team.integrations} Integrations</span>
					<span>{team.issues} Issues</span>
					<span className="flex items-center gap-1">
						<FaCalendar className="w-3 h-3" />
						{team.dueDate}
					</span>
				</div>
				{onViewTeam && (
					<button
						onClick={onViewTeam}
						className="text-xs text-blue-400 hover:text-blue-300 font-medium flex items-center gap-1 flex-shrink-0"
					>
						View Team
						<FaArrowRight className="w-3 h-3" />
					</button>
				)}
			</div>
		</div>
	);
}
