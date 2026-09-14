import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { Team, TeamMemberInfo } from "@/types";
import api from "@/lib/api-client";
import Layout from "@/components/Layout";
import TeamCard from "@/components/TeamCard";
import {
	FaSearch,
	FaFilter,
	FaPlus,
	FaUsers,
	FaCheckCircle,
	FaClock,
	FaCalendar,
	FaTasks,
	FaEllipsisH,
	FaChartPie,
	FaFileAlt,
	FaArrowRight,
	FaTimes,
} from "react-icons/fa";
import InteractiveDonut from "@/components/InteractiveDonut";


const QUICK_ACTIONS = [
	{ label: "Create New Team", icon: FaPlus, href: "#" },
	{ label: "Manage Team Templates", icon: FaFilter, href: "#" },
	{ label: "View Team Reports", icon: FaSearch, href: "#" },
	{ label: "Team Resource Planning", icon: FaCalendar, href: "#" },
];

const SORT_OPTIONS = [
	{ value: "name", label: "Sort by: Name" },
	{ value: "status", label: "Sort by: Status" },
	{ value: "sprint", label: "Sort by: Sprint" },
];

const STATUS_FILTER_OPTIONS = [
	{ value: "all", label: "All Teams" },
	{ value: "active", label: "Active" },
	{ value: "paused", label: "On Hold" },
	{ value: "archived", label: "Archived" },
];

const COLOR_CLASS: Record<string, string> = {
	blue: "bg-blue-500",
	purple: "bg-purple-500",
	orange: "bg-orange-500",
	green: "bg-green-500",
};
const COLOR_TEXT: Record<string, string> = {
	blue: "text-blue-400",
	purple: "text-purple-400",
	orange: "text-orange-400",
	green: "text-green-400",
};
const COLOR_LIGHT: Record<string, string> = {
	blue: "bg-blue-400",
	purple: "bg-purple-400",
	orange: "bg-orange-400",
	green: "bg-green-400",
};
const COLOR_DOT: Record<string, string> = {
	blue: "bg-blue-400",
	purple: "bg-purple-400",
	orange: "bg-orange-400",
	green: "bg-green-400",
};

// Convert Activity to display shape for the activity feed
function activityToDisplay(activity: any) {
	return {
		id: activity.id,
		description: activity.description,
		timestamp: new Date(activity.createdAt).toLocaleString("en-US", {
			month: "short",
			day: "numeric",
			hour: "2-digit",
			minute: "2-digit",
		}),
		letter: activity.member?.name?.charAt(0) || "?",
		teamColor: "blue",
	};
}

// Enrich raw API team data to match TeamCard's expected shape
function enrichTeam(raw: any): Team {
	const letter = (raw.id || "A").charAt(0).toUpperCase();
	const teamColor = (raw.id?.includes("alpha") || raw.id?.includes("beta"))
		? "blue"
		: raw.id?.includes("gamma")
			? "orange"
			: raw.id?.includes("delta")
				? "green"
				: "purple";

	return {
		id: raw.id,
		name: raw.name,
		description: raw.description || "",
		status: raw.status || "active",
		letter: letter as Team["letter"],
		teamColor: teamColor as Team["teamColor"],
		sprint: raw.tasks?.length ? 1 : 0,
		sprintOf: 4,
		sprintProgress: raw.sprintProgress ?? 0,
		daysLeft: null,
		activeSprints: raw.tasks?.filter((t: any) => t.status === "in_progress").length || 0,
		openTasks: raw.tasks?.filter((t: any) => t.status !== "done" && t.status !== "completed").length || 0,
		completed: raw.tasks?.filter((t: any) => t.status === "done" || t.status === "completed").length || 0,
		features: 0,
		integrations: 0,
		issues: raw.tasks?.filter((t: any) => t.status === "blocked").length || 0,
		dueDate: "",
		members: raw.members || [],
		teamMembers: (raw.members || []).map((m: any) => ({
			name: m.name || "Unknown",
			model: "Sonnet",
		})),
		tasks: raw.tasks || [],
		createdAt: raw.createdAt || "",
		updatedAt: raw.updatedAt || "",
	};
}

const Teams: React.FC = () => {
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("all");
	const [sortBy, setSortBy] = useState("name");
	const [showNewTeamModal, setShowNewTeamModal] = useState(false);
	const [teams, setTeams] = useState<Team[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activities, setActivities] = useState<any[]>([]);
	const [creating, setCreating] = useState(false);

	useEffect(() => {
		Promise.all([api.getTeams(), api.getActivities()])
			.then(([teamsData, activitiesData]) => {
				setTeams((teamsData as any[]).map(enrichTeam));
				setActivities(activitiesData as any[]);
			})
			.catch((err) => {
				console.error("Failed to load teams:", err);
				setError(err.message || "Failed to load teams");
			})
			.finally(() => {
				setLoading(false);
			});
	}, []);

	const filteredTeams = teams
		.filter((team) => {
			const q = searchQuery.toLowerCase();
			const matchesSearch =
				team.name.toLowerCase().includes(q) ||
				(team.description || "").toLowerCase().includes(q);
			const matchesStatus =
				statusFilter === "all" || team.status === statusFilter;
			return matchesSearch && matchesStatus;
		})
		.sort((a, b) => {
			if (sortBy === "name") return a.name.localeCompare(b.name);
			if (sortBy === "status") return a.status.localeCompare(b.status);
			if (sortBy === "sprint") return b.sprint - a.sprint;
			return 0;
		});

	const totalTeams = teams.length;
	const activeCount = teams.filter((t) => t.status === "active").length;
	const onHoldCount = teams.filter((t) => t.status === "paused").length;
	const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0);

	const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setError("");
		setCreating(true);

		const form = e.currentTarget;
		const nameInput = form.elements.namedItem(
			"teamName"
		) as HTMLInputElement;
		const descInput = form.elements.namedItem(
			"teamDescription"
		) as HTMLTextAreaElement;
		const statusInput = form.elements.namedItem(
			"teamStatus"
		) as HTMLSelectElement;

		const name = nameInput?.value.trim();
		const description = descInput?.value.trim() || undefined;
		const status = (statusInput?.value || "active") as Team["status"];

		if (!name) {
			setError("Team name is required");
			setCreating(false);
			return;
		}

		try {
			const response = await fetch("/api/teams", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ name, description, status }),
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(
					data.error || `Failed to create team (HTTP ${response.status})`
				);
			}

			const newTeam = await response.json();
			setTeams((prev) => [enrichTeam(newTeam), ...prev]);
			setShowNewTeamModal(false);
			form.reset();
		} catch (err: any) {
			setError(err.message || "Something went wrong");
		} finally {
			setCreating(false);
		}
	};

	const handleNavigate = (item: string) => {
		const navHref: Record<string, string> = {
			overview: "/",
			teams: "/teams",
			tasks: "/tasks",
			agents: "/agents",
			projects: "/projects",
			activity: "/activity",
			settings: "/settings",
			sprints: "/sprints",
		};
		router.push(navHref[item] || "/");
	};

	return (
		<Layout activeNav="teams" onNavigate={handleNavigate}>
			<div className="px-6 py-6 space-y-6">
				{/* Page header and controls */}
				<div className="flex flex-col gap-4">
					<div>
						<h1 className="text-2xl font-bold text-white">Teams</h1>
						<p className="text-sm text-slate-400 mt-1">
							Manage your AI development teams, monitor sprint progress, and track team activity.
						</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						<div className="relative flex-1 min-w-[200px] max-w-md">
							<FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search teams..."
								className="input-dark w-full pl-10 pr-4 py-2 text-sm"
							/>
						</div>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="input-dark text-sm py-2 px-3"
						>
							{STATUS_FILTER_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value)}
							className="input-dark text-sm py-2 px-3"
						>
							{SORT_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={() => setShowNewTeamModal(true)}
							className="btn-primary flex items-center justify-center gap-2 text-sm py-2 px-4 sm:ml-auto"
						>
							<FaPlus className="w-4 h-4" />
							Create New Team
						</button>
					</div>
				</div>

			{/* -- Stats summary row ---------------------------------------- */}
			<div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
				<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4">
					<p className="text-slate-400 text-xs mb-1">Total Teams</p>
					<p className="text-white text-2xl font-bold">{totalTeams}</p>
				</div>
				<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4">
					<p className="text-slate-400 text-xs mb-1">Active</p>
					<div className="flex items-center gap-2">
						<FaCheckCircle className="w-3 h-3 text-green-400" />
						<p className="text-white text-2xl font-bold">
							{activeCount}
						</p>
					</div>
				</div>
				<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4">
					<p className="text-slate-400 text-xs mb-1">On Hold</p>
					<div className="flex items-center gap-2">
						<FaClock className="w-3 h-3 text-orange-400" />
						<p className="text-white text-2xl font-bold">
							{onHoldCount}
						</p>
					</div>
				</div>
				<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4">
					<p className="text-slate-400 text-xs mb-1">Total Members</p>
					<div className="flex items-center gap-2">
						<FaUsers className="w-3 h-3 text-blue-400" />
						<p className="text-white text-2xl font-bold">
							{totalMembers}
						</p>
					</div>
				</div>
			</div>

			{/* -- Main grid: 3/4 left + 1/4 right ------------------------- */}
			<div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
				{/* -- LEFT: Development Teams ------------------------------- */}
				<div className="xl:col-span-3">
					<div className="mb-4">
						<h2 className="text-white font-semibold text-base">
							Development Teams
						</h2>
						<p className="text-slate-400 text-xs mt-0.5">
							Manage your AI development teams. Each team has a full
							Agile setup with specialized AI agents.
						</p>
					</div>

					{loading ? (
						<div className="text-center py-12 bg-[#1a1d2e] border border-slate-700 rounded-lg">
							<p className="text-slate-400 text-sm">Loading teams...</p>
						</div>
					) : error ? (
						<div className="text-center py-12 bg-[#1a1d2e] border border-red-700 rounded-lg">
							<p className="text-red-400 text-sm">{error}</p>
							<button
								onClick={() => window.location.reload()}
								className="text-blue-400 text-sm mt-2 hover:underline"
							>
								Retry
							</button>
						</div>
					) : filteredTeams.length === 0 ? (
						<div className="text-center py-12 bg-[#1a1d2e] border border-slate-700 rounded-lg">
							<p className="text-slate-400 text-sm">
								No teams match your filters
							</p>
							<button
								onClick={() => {
									setSearchQuery("");
									setStatusFilter("all");
								}}
								className="text-blue-400 text-sm mt-2 hover:underline"
							>
								Clear filters
							</button>
						</div>
					) : (
						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							{filteredTeams.map((team) => (
								<TeamCard
									key={team.id}
									team={team}
									onViewTeam={() => {}}
								/>
							))}
						</div>
					)}
				</div>

				{/* -- RIGHT: Sidebar panels -------------------------------- */}
				<div className="xl:col-span-1 space-y-4">
					{/* -- Team Overview (Donut chart) ----------------------- */}
					<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4">
						<h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
							<FaChartPie className="w-4 h-4 text-slate-400" />
							Team Overview
						</h3>
						<InteractiveDonut
							segments={[
								{ label: "Active", value: activeCount, color: "#4ade80" },
								{ label: "On Hold", value: onHoldCount, color: "#fbbf24" },
								{ label: "Archived", value: teams.filter((t) => t.status === "archived").length, color: "#94a3b8" },
							]}
							size={160}
							strokeWidth={18}
							centerLabel="Teams"
							showLegend={true}
						/>
					</div>

					{/* -- Teams by Project Type ---------------------------- */}
					<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4">
						<h3 className="text-white text-sm font-semibold mb-3 flex items-center gap-2">
							<FaFileAlt className="w-4 h-4 text-slate-400" />
							Teams by Project Type
						</h3>
						<div className="space-y-2.5">
							{[
								{ label: "Web Application", count: 1, color: "blue" },
								{ label: "Mobile Application", count: 1, color: "purple" },
								{ label: "Internal Tools", count: 1, color: "green" },
								{ label: "Data & Analytics", count: 1, color: "orange" },
							].map((pt) => (
								<div key={pt.label}>
									<div className="flex items-center justify-between text-xs mb-1">
										<span className="text-slate-300">
											{pt.label}
										</span>
										<span className="text-slate-400">
											{pt.count}
										</span>
									</div>
									<div className="w-full bg-slate-700 rounded-full h-1.5">
										<div
											className={`${COLOR_CLASS[pt.color]} h-1.5 rounded-full`}
											style={{
												width: `${
													(pt.count / Math.max(totalTeams, 1)) *
													100
												}%`,
											}}
										/>
									</div>
								</div>
							))}
						</div>
					</div>

					{/* -- Recent Team Activity ----------------------------- */}
					<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4">
						<h3 className="text-white text-sm font-semibold mb-3">
							Recent Activity
						</h3>
						<div className="space-y-3">
							{activities.slice(0, 5).map((raw) => {
								const act = activityToDisplay(raw);
								return (
									<div
										key={act.id}
										className="flex items-start gap-2.5"
									>
										<div
											className={`w-7 h-7 rounded-full ${COLOR_CLASS[act.teamColor] || COLOR_CLASS.blue} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
										>
											{act.letter}
										</div>
										<div className="flex-1 min-w-0">
											<p className="text-xs text-slate-300 leading-snug">
												{act.description}
											</p>
											<p className="text-[11px] text-slate-500 mt-0.5">
												{act.timestamp}
											</p>
										</div>
									</div>
								);
							})}
						</div>
						<button className="flex items-center gap-1 text-xs text-blue-400 hover:text-blue-300 mt-3">
							View All <FaArrowRight className="w-3 h-3" />
						</button>
					</div>

					{/* -- Quick Actions ------------------------------------ */}
					<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4">
						<h3 className="text-white text-sm font-semibold mb-3">
							Quick Actions
						</h3>
						<div className="space-y-1">
							{QUICK_ACTIONS.map((qa) => {
								const Icon = qa.icon;
								return (
									<button
										key={qa.label}
										className="w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs text-slate-300 hover:bg-slate-700/50 hover:text-white transition-colors text-left"
									>
										<Icon className="w-3.5 h-3.5 text-slate-400" />
										{qa.label}
									</button>
								);
							})}
						</div>
					</div>
				</div>
			</div>

			{/* -- New Team Modal -------------------------------------------- */}
			{showNewTeamModal && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
					<div className="bg-[#1a1d2e] border border-slate-700 rounded-lg w-full max-w-md animate-fade-in">
						<div className="flex items-center justify-between p-4 border-b border-slate-700">
							<h2 className="text-lg font-semibold text-white">
								Create New Team
							</h2>
							<button
								onClick={() => setShowNewTeamModal(false)}
								className="p-1 rounded hover:bg-slate-700 text-slate-400"
							>
								<FaTimes className="w-5 h-5" />
							</button>
						</div>
						<form onSubmit={handleCreateTeam} className="p-4 space-y-4">
							{error && (
								<div className="bg-red-400/10 text-red-400 text-sm rounded-lg px-3 py-2">
									{error}
								</div>
							)}
							<div>
								<label className="block text-sm text-slate-400 mb-1">
									Team Name
								</label>
								<input
									name="teamName"
									type="text"
									required
									placeholder="e.g. Frontend Squad"
									className="input-dark w-full"
								/>
							</div>
							<div>
								<label className="block text-sm text-slate-400 mb-1">
									Description
								</label>
								<textarea
									name="teamDescription"
									rows={3}
									placeholder="What does this team do?"
									className="input-dark w-full resize-none"
								/>
							</div>
							<div>
								<label className="block text-sm text-slate-400 mb-1">
									Status
								</label>
								<select
									name="teamStatus"
									className="input-dark w-full"
								>
									<option value="active">Active</option>
									<option value="paused">Paused</option>
									<option value="archived">Archived</option>
								</select>
							</div>
							<div className="flex justify-end gap-2 pt-2">
								<button
									type="button"
									onClick={() => {
										setShowNewTeamModal(false);
										setError("");
									}}
									className="btn-secondary"
									disabled={creating}
								>
									Cancel
								</button>
								<button
									type="submit"
									className="btn-primary"
									disabled={creating}
								>
									{creating ? "Creating..." : "Create Team"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
			</div>
		</Layout>
	);
};

export default Teams;
