import { FaTimes } from "react-icons/fa";
import React, { useEffect, useState, useMemo } from "react";
import { useRouter } from "next/router";
import type { ProjectStatus } from "@/types";
import Layout from "@/components/Layout";
import {
	FaSearch,
	FaPlus,
	FaFilter,
	FaMicrochip,
	FaCog,
	FaCheckCircle,
	FaTimesCircle,
	FaEllipsisH,
	FaDollarSign,
	FaUsers,
	FaClock,
	FaExternalLinkAlt,
	FaCodeBranch,
	FaEye,
	FaEdit,
	FaTrash,
	FaFolderOpen,
	FaTasks,
	FaSpinner,
	FaArrowRight,
} from "react-icons/fa";

import InteractiveDonut from "@/components/InteractiveDonut";
import api from "@/lib/api-client";

// ── Types ────────────────────────────────────────────────────────────────

interface ProjectType {
	id: string;
	name: string;
	team: string;
	teamLetter: string;
	type: string;
	typeBadge: string;
	progress: number;
	members: number;
	dueDate: string;
	status: string;
	startDate: string;
	endDate: string;
	budget: string;
}

interface KanbanColumn {
	title: string;
	headerColor: string;
	bgColor: string;
	count: number;
	projects: ProjectType[];
}

interface ActivityItem {
	teamLetter: string;
	teamColor: string;
	description: string;
	timestamp: string;
}

// ── Static Dashboard Chrome (not project data) ────────────────────────────

const RECENT_ACTIVITY: ActivityItem[] = [];

const PROJECT_TYPE_DATA: {label:string;value:number;color:string;width:string}[] = [];

const quickActions = [
	{ label: "New Project", icon: <FaPlus /> },
	{ label: "Import CSV", icon: <FaCodeBranch /> },
	{ label: "Export Report", icon: <FaExternalLinkAlt /> },
	{ label: "Project Templates", icon: <FaTasks /> },
];

// ── Helpers ───────────────────────────────────────────────────────────────

const STATUS_MAP: Record<string, { label: string; color: string; badge: string }> = {
	active: { label: "Active", color: "bg-green-500", badge: "bg-green-400/10 text-green-400" },
	paused: { label: "On Hold", color: "bg-orange-500", badge: "bg-orange-400/10 text-orange-400" },
	completed: { label: "Completed", color: "bg-slate-500", badge: "bg-slate-400/10 text-slate-400" },
	planning: { label: "Planning", color: "bg-purple-500", badge: "bg-purple-400/10 text-purple-400" },
	testing: { label: "Testing", color: "bg-yellow-500", badge: "bg-yellow-400/10 text-yellow-400" },
	deployment:{ label: "Deployment", color: "bg-green-500", badge: "bg-emerald-400/10 text-emerald-400" },
	idea: { label: "Idea", color: "bg-blue-500", badge: "bg-blue-400/10 text-blue-400" },
};

const TYPE_COLORS: Record<string, { badge: string }> = {
	"Web App": { badge: "bg-blue-400/10 text-blue-400" },
	"Mobile": { badge: "bg-purple-400/10 text-purple-400" },
	"Internal": { badge: "bg-green-400/10 text-green-400" },
	"Analytics": { badge: "bg-orange-400/10 text-orange-400" },
	"Backend": { badge: "bg-slate-400/10 text-slate-400" },
	"Web Application": { badge: "bg-blue-400/10 text-blue-400" },
	"Mobile Application": { badge: "bg-purple-400/10 text-purple-400" },
	"Data & Analytics": { badge: "bg-orange-400/10 text-orange-400" },
};

const TEAM_LETTERS: Record<string, string> = {
	"team-alpha": "A", "team-beta": "B", "team-gamma": "G", "team-delta": "D",
};

function progressColor(pct: number) {
	if (pct >= 80) return "bg-green-500";
	if (pct >= 40) return "bg-blue-500";
	if (pct >= 15) return "bg-orange-500";
	return "bg-slate-500";
}

// Transform a DB project into the shape the UI expects.
// Missing fields get safe defaults so the UI degrades gracefully.
function transformProject(p: {
	id: string;
	name: string;
	description?: string;
	status: string;
	progress: number;
	teamId: string;
	milestones: { id: string; title: string; status: string; order: number; projectId: string }[];
	repoUrl?: string;
	createdAt: string;
	updatedAt: string;
}): ProjectType {
	const rawStatus = p.status.toLowerCase();
	const statusInfo = STATUS_MAP[rawStatus] || { label: rawStatus, badge: "bg-slate-400/10 text-slate-400" };
	const letter = TEAM_LETTERS[p.teamId] || p.teamId.charAt(0).toUpperCase();

	const typeLabel = p.description?.toLowerCase().includes("mobile")
		? "Mobile"
		: p.description?.toLowerCase().includes("analytics") || p.description?.toLowerCase().includes("data")
			? "Analytics"
			: p.description?.toLowerCase().includes("backend") || p.description?.toLowerCase().includes("api")
				? "Backend"
				: p.description?.toLowerCase().includes("internal")
					? "Internal"
					: "Web App";

	const typeStyle = TYPE_COLORS[typeLabel] || { badge: "bg-blue-400/10 text-blue-400" };

	const taskCount = p.milestones?.length || 0;
	const createdAt = new Date(p.createdAt);
	const dueDate = new Date(createdAt);
	dueDate.setMonth(dueDate.getMonth() + 3);

	return {
		id: p.id,
		name: p.name,
		team: p.teamId,
		teamLetter: letter,
		type: typeLabel,
		typeBadge: typeStyle.badge,
		progress: Math.min(100, Math.max(0, p.progress)),
		members: 0,
		dueDate: "Not set",
		status: statusInfo.label.toLowerCase(),
		startDate: createdAt.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }),
		endDate: "Not set",
		budget: "—",
	};
}

// Group projects into kanban columns based on status
function buildKanbanColumns(projects: ProjectType[]): KanbanColumn[] {
	const columns: KanbanColumn[] = [
		{ title: "Idea / Intake", headerColor: "bg-blue-500", bgColor: "bg-blue-500/5", count: 0, projects: [] },
		{ title: "Planning", headerColor: "bg-purple-500", bgColor: "bg-purple-500/5", count: 0, projects: [] },
		{ title: "In Development", headerColor: "bg-orange-500", bgColor: "bg-orange-500/5", count: 0, projects: [] },
		{ title: "Testing", headerColor: "bg-yellow-500", bgColor: "bg-yellow-500/5", count: 0, projects: [] },
		{ title: "Completed", headerColor: "bg-slate-500", bgColor: "bg-slate-500/5", count: 0, projects: [] },
	];

	const statusToColumn: Record<string, number> = {
		idea: 0, planning: 1, active: 2, testing: 3, deployment: 3, completed: 4,
		paused: 2, "on hold": 2, "on-hold": 2,
	};

	for (const proj of projects) {
		const idx = statusToColumn[proj.status] ?? 2;
		columns[idx].projects.push(proj);
	}

	for (const col of columns) {
		col.count = col.projects.length;
	}

	return columns;
}

// ── Progress Bar Component ────────────────────────────────────────────────

function ProgressBar({ value, color = "bg-blue-500" }: { value: number; color?: string }) {
	return (
		<div className="w-full bg-[var(--bg-tertiary)] rounded-full h-1.5">
			<div className={`${color} h-1.5 rounded-full transition-all`} style={{ width: `${value}%` }} />
		</div>
	);
}

// ── Loading Spinner ──────────────────────────────────────────────────────

function LoadingSpinner() {
	return (
		<div className="flex flex-col items-center justify-center py-20 gap-4">
			<FaSpinner className="w-10 h-10 text-blue-400 animate-spin" />
			<p className="text-sm text-slate-400">Loading projects...</p>
		</div>
	);
}

// ── Empty State ──────────────────────────────────────────────────────────

function EmptyState({ onAdd }: { onAdd: () => void }) {
	return (
		<div className="flex flex-col items-center justify-center py-20 gap-4">
			<FaFolderOpen className="w-12 h-12 text-slate-600" />
			<p className="text-sm text-slate-400">No projects found.</p>
			<button
				onClick={onAdd}
				className="bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)] text-sm px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
			>
				<FaPlus className="w-3 h-3" />
				Add Project
			</button>
		</div>
	);
}

// ── Projects Page ────────────────────────────────────────────────────────

const ProjectsPage: React.FC = () => {
	const router = useRouter();
	const [search, setSearch] = useState("");
	const [teamFilter, setTeamFilter] = useState("All Teams");
	const [statusFilter, setStatusFilter] = useState("All Status");
	const [projects, setProjects] = useState<ProjectType[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [showAddModal, setShowAddModal] = useState(false);
	const [creating, setCreating] = useState(false);
 const [availableTeams, setAvailableTeams] = useState<{id:string;name:string}[]>([]);
 useEffect(() => {api.getTeams().then(setAvailableTeams).catch(e => setError(e.message));}, []);

	const handleNavigate = (_navId: string) => {
		router.push("/");
	};

	// Fetch projects from the API on mount
	useEffect(() => {
		let cancelled = false;

		async function loadProjects() {
			setLoading(true);
			setError(null);
			try {
				const data = await api.getProjects();
				if (cancelled) return;
				// API returns an array of Project objects
				const rawProjects = Array.isArray(data) ? data : (data as { projects?: unknown[] }).projects || [];
				const transformed = rawProjects.map(transformProject);
				setProjects(transformed);
			} catch (err) {
				if (cancelled) return;
				setError(err instanceof Error ? err.message : "Failed to load projects");
			} finally {
				if (!cancelled) {
					setLoading(false);
				}
			}
		}

		loadProjects();
		return () => { cancelled = true; };
	}, []);

	// Filtered projects for kanban and table
	const filteredProjects = useMemo(() => {
		return projects.filter((proj) => {
			const q = search.toLowerCase();
			const matchesSearch = proj.name.toLowerCase().includes(q) || proj.team.toLowerCase().includes(q);
			const matchesTeam = teamFilter === "All Teams" || proj.team === teamFilter.toLowerCase().replace(" ", "-");
			const matchesStatus = statusFilter === "All Status" || proj.status === statusFilter.toLowerCase();
			return matchesSearch && matchesTeam && matchesStatus;
		});
	}, [projects, search, teamFilter, statusFilter]);

	const kanbanColumns = useMemo(() => buildKanbanColumns(filteredProjects), [filteredProjects]);

	// Derived stats from real project data
	const statsCards = useMemo(() => {
		const total = projects.length;
		const active = projects.filter(p => p.status === "active").length;
		const onHold = projects.filter(p => p.status === "paused" || p.status === "on hold").length;
		const atRisk = projects.filter(p => p.progress < 25 && p.status === "active").length;
		const completed = projects.filter(p => p.status === "completed").length;
		return [
			{ label: "Total Projects", value: String(total), icon: <FaFolderOpen />, color: "text-blue-400", bg: "bg-blue-400/10" },
			{ label: "Active", value: String(active), icon: <FaCheckCircle />, color: "text-green-400", bg: "bg-green-400/10" },
			{ label: "On Hold", value: String(onHold), icon: <FaClock />, color: "text-orange-400", bg: "bg-orange-400/10" },
			{ label: "At Risk", value: String(atRisk), icon: <FaTimesCircle />, color: "text-red-400", bg: "bg-red-400/10" },
			{ label: "Completed", value: String(completed), icon: <FaCheckCircle />, color: "text-slate-400", bg: "bg-slate-400/10" },
			{ label: "Total Milestones", value: String(projects.reduce((s, p) => s + (p.members > 0 ? 0 : 0), 0)), icon: <FaTasks />, color: "text-emerald-400", bg: "bg-emerald-400/10" },
		];
	}, [projects]);

	// Placeholder: Add Project (opens a simple modal, does nothing on submit yet)
 const handleAddProject = async (e: React.FormEvent<HTMLFormElement>) => {
  e.preventDefault();setCreating(true);setError(null);
  const form = new FormData(e.currentTarget);
  try {
   const created = await api.createProject({name:String(form.get('name')).trim(),teamId:String(form.get('teamId')),description:String(form.get('description'))});
   setProjects(current => [transformProject(created), ...current]);setShowAddModal(false);
  } catch(e) {setError((e as Error).message);} finally {setCreating(false);}
 };

	return (
		<Layout activeNav="projects" onNavigate={handleNavigate}>
			<div className="w-full min-w-0 px-4 sm:px-6 py-4 space-y-6">
				{/* Page Header */}
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-[var(--text-primary)]">Projects</h1>
						<p className="text-sm text-slate-400 mt-1">Track project pipeline, status, and team progress.</p>
					</div>
					<button
						onClick={() => setShowAddModal(true)}
						className="bg-blue-600 hover:bg-blue-500 text-[var(--text-primary)] text-sm px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
					>
						<FaPlus className="w-3 h-3" />
						Add Project
					</button>
				</div>

				{/* Loading State */}
				{loading && <LoadingSpinner />}

				{/* Error State */}
				{!loading && error && (
					<div className="bg-red-500/10 border border-red-500/30 rounded-lg p-4 flex items-center gap-3">
						<FaTimesCircle className="text-red-400 w-5 h-5 flex-shrink-0" />
						<div>
							<p className="text-sm text-red-300 font-medium">Failed to load projects</p>
							<p className="text-xs text-red-400 mt-1">{error}</p>
						</div>
						<button
							onClick={() => {
								setLoading(true);
								setError(null);
								api.getProjects()
									.then(data => {
										const raw = Array.isArray(data) ? data : (data as { projects?: unknown[] }).projects || [];
										setProjects(raw.map(transformProject));
									})
									.catch(err => setError(err instanceof Error ? err.message : "Failed to load projects"))
									.finally(() => setLoading(false));
							}}
							className="ml-auto text-xs bg-red-500/20 hover:bg-red-500/30 text-red-300 px-3 py-1.5 rounded-md transition-colors"
						>
							Retry
						</button>
					</div>
				)}

				{/* Empty State */}
				{!loading && !error && projects.length === 0 && (
					<EmptyState onAdd={() => setShowAddModal(true)} />
				)}

				{/* Main Content — only render when not loading and no error */}
				{!loading && !error && projects.length > 0 && (
					<>
						{/* Action Bar */}
						<div className="flex flex-wrap items-center gap-3">
							<div className="relative flex-1 min-w-[200px] max-w-sm">
								<FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
								<input
									type="text"
									placeholder="Search projects..."
									value={search}
									onChange={(e) => setSearch(e.target.value)}
									className="w-full bg-[var(--surface-card)] border border-[var(--border-default)] rounded-md pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
								/>
							</div>
							<select
								value={teamFilter}
								onChange={(e) => setTeamFilter(e.target.value)}
								className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
							>
								<option>All Teams</option>
								<option>Team Alpha</option>
								<option>Team Beta</option>
								<option>Team Gamma</option>
								<option>Team Delta</option>
							</select>
							<select
								value={statusFilter}
								onChange={(e) => setStatusFilter(e.target.value)}
								className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
							>
								<option>All Status</option>
								<option>Active</option>
								<option>On Hold</option>
								<option>At Risk</option>
								<option>Completed</option>
							</select>
						</div>

						{/* Stats Row */}
						<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
							{statsCards.map((s) => (
								<div key={s.label} className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
									<div className="flex items-start justify-between">
										<div>
											<p className="text-xs text-slate-400 mb-1">{s.label}</p>
											<p className="text-xl font-bold text-[var(--text-primary)]">{s.value}</p>
										</div>
										<div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>
											{React.cloneElement(s.icon as React.ReactElement, { className: "w-4 h-4" })}
										</div>
									</div>
								</div>
							))}
						</div>

						{/* Kanban Pipeline */}
						<div className="min-w-0">
							<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5 gap-3 min-w-0">
								{kanbanColumns.map((col) => (
									<div key={col.title} className={`min-w-0 rounded-lg border border-[var(--border-default)] ${col.bgColor}`}>
										{/* Column Header */}
										<div className={`${col.headerColor} text-[var(--text-primary)] text-sm font-semibold px-3 py-2 rounded-t-lg flex items-center justify-between`}>
											<span>{col.title}</span>
											<span className="bg-white/20 text-xs px-2 py-0.5 rounded-full">{col.count}</span>
										</div>
										{/* Cards */}
										<div className="p-2 space-y-2">
											{col.projects.map((proj) => (
												<div
													key={proj.id}
													onClick={() => router.push(`/projects/${proj.id}`)}
													className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-md p-3 hover:border-slate-600 cursor-pointer transition-colors"
												>
													<div className="flex items-start justify-between mb-1">
														<div>
															<span className="text-sm font-semibold text-[var(--text-primary)]">{proj.name}</span>
															<p className="text-xs text-slate-500">{proj.team}</p>
														</div>
														<span className={`text-[10px] px-1.5 py-0.5 rounded-full ${proj.typeBadge}`}>{proj.type}</span>
													</div>
													<div className="mt-2">
														<div className="flex items-center justify-between mb-1">
															<span className="text-[10px] text-slate-500">Progress</span>
															<span className="text-[10px] text-slate-400">{proj.progress}%</span>
														</div>
														<ProgressBar value={proj.progress} color={progressColor(proj.progress)} />
													</div>
													<div className="flex items-center justify-between mt-2 text-[10px] text-slate-500">
														<span className="flex items-center gap-1">
															<FaUsers className="w-2.5 h-2.5" />
															{proj.members > 0 ? `${proj.members} members` : "No members"}
														</span>
														<span className="flex items-center gap-1">
															<FaClock className="w-2.5 h-2.5" />
															{proj.dueDate}
														</span>
													</div>
												</div>
											))}
										</div>
									</div>
								))}
							</div>
						</div>

						{/* Summary tiles */}
						<div className="grid grid-cols-1 md:grid-cols-2 2xl:grid-cols-3 gap-4 min-w-0">
							{/* Project Overview Donut */}
							<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
								<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Project Overview</h3>
								<InteractiveDonut
									segments={[
										{ label: "Active", value: projects.filter(p => p.status === "active").length, color: "#22c55e" },
										{ label: "On Hold", value: projects.filter(p => p.status === "paused" || p.status === "on hold").length, color: "#f97316" },
										{ label: "At Risk", value: projects.filter(p => p.progress < 25 && p.status === "active").length, color: "#ef4444" },
										{ label: "Completed", value: projects.filter(p => p.status === "completed").length, color: "#94a3b8" },
									]}
									size={140}
									strokeWidth={22}
									centerLabel="Projects"
									showLegend={true}
								/>
							</div>

							{/* Projects by Type */}
							<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
								<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Projects by Type</h3>
								<div className="space-y-3">
									{PROJECT_TYPE_DATA.map((item) => (
										<div key={item.label}>
											<div className="flex items-center justify-between text-xs mb-1">
												<span className="text-slate-400">{item.label}</span>
												<span className="text-slate-500">{item.value}</span>
											</div>
											<div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2">
												<div className={`${item.color} h-2 rounded-full`} style={{ width: item.width }} />
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Recent Team Activity */}
							<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
								<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Recent Team Activity</h3>
								<div className="space-y-3">
									{RECENT_ACTIVITY.map((item, i) => (
										<div key={i} className="flex items-start gap-3">
											<div className={`w-7 h-7 rounded-full ${item.teamColor} flex items-center justify-center text-[var(--text-primary)] text-xs font-bold flex-shrink-0`}>
												{item.teamLetter}
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-xs text-slate-300 truncate">{item.description}</p>
												<p className="text-[10px] text-slate-500">{item.timestamp}</p>
											</div>
										</div>
									))}
								</div>
							</div>

							{/* Quick Actions */}
							<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
								<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Quick Actions</h3>
								<div className="space-y-1">
									{quickActions.map((action) => (
										<button
											key={action.label}
											className="w-full flex items-center gap-2 px-3 py-2 text-sm text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors text-left"
										>
											{action.icon}
											{action.label}
										</button>
									))}
								</div>
							</div>
						</div>

						{/* All Projects Table */}
						<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
							<div className="px-4 py-3 border-b border-[var(--border-default)]">
								<h3 className="text-sm font-semibold text-[var(--text-primary)]">All Projects</h3>
							</div>
							<div className="w-full min-w-0">
								<table className="w-full table-auto text-xs">
									<thead>
										<tr className="text-xs text-slate-500 border-b border-[var(--border-default)]">
											<th className="text-left px-4 py-2 font-medium">#</th>
											<th className="text-left px-4 py-2 font-medium">Project Name</th>
											<th className="text-left px-4 py-2 font-medium">Team</th>
											<th className="text-left px-4 py-2 font-medium">Type</th>
											<th className="text-left px-4 py-2 font-medium">Status</th>
											<th className="text-left px-4 py-2 font-medium">Progress</th>
											<th className="text-left px-4 py-2 font-medium">Start Date</th>
											<th className="text-left px-4 py-2 font-medium">End Date</th>
											<th className="text-left px-4 py-2 font-medium">Actions</th>
										</tr>
									</thead>
									<tbody>
										{filteredProjects.map((proj, idx) => (
											<tr key={proj.id} className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-secondary)]/30">
												<td className="px-4 py-3 text-slate-500">{idx + 1}</td>
												<td className="px-4 py-3 text-[var(--text-primary)] font-medium">{proj.name}</td>
												<td className="px-4 py-3 text-slate-400">
													<span className="flex items-center gap-2">
														<span className="w-5 h-5 rounded-full bg-slate-600 flex items-center justify-center text-[10px] text-[var(--text-primary)] font-bold">
															{proj.teamLetter}
														</span>
														{proj.team}
													</span>
												</td>
												<td className="px-4 py-3">
													<span className={`text-xs px-2 py-0.5 rounded-full ${proj.typeBadge}`}>{proj.type}</span>
												</td>
												<td className="px-4 py-3">
													<span className={`text-xs px-2 py-0.5 rounded-full ${
														proj.status === "active" ? "bg-green-400/10 text-green-400" :
														proj.status === "completed" ? "bg-slate-400/10 text-slate-400" :
														"bg-orange-400/10 text-orange-400"
													}`}>
														{proj.status.charAt(0).toUpperCase() + proj.status.slice(1)}
													</span>
												</td>
												<td className="px-4 py-3">
													<div className="flex items-center gap-2">
														<div className="w-16">
															<ProgressBar value={proj.progress} color={progressColor(proj.progress)} />
														</div>
														<span className="text-xs text-slate-400 w-8">{proj.progress}%</span>
													</div>
												</td>
												<td className="px-4 py-3 text-slate-400">{proj.startDate}</td>
												<td className="px-4 py-3 text-slate-400">{proj.endDate}</td>
												<td className="px-4 py-3">
													<div className="flex items-center gap-2">
														<button
															onClick={() => router.push(`/projects/${proj.id}`)}
															className="text-slate-400 hover:text-blue-400 transition-colors"
															title="View"
														>
															<FaEye className="w-3.5 h-3.5" />
														</button>
														<button className="text-slate-400 hover:text-yellow-400 transition-colors" title="Edit">
															<FaEdit className="w-3.5 h-3.5" />
														</button>
														<button
															onClick={async () => {
																try {
																	await api.deleteProject(proj.id);
																	setProjects(prev => prev.filter(p => p.id !== proj.id));
																} catch {
																	// Silently fail — could add toast notification
																}
															}}
															className="text-slate-400 hover:text-red-400 transition-colors"
															title="Delete"
														>
															<FaTrash className="w-3.5 h-3.5" />
														</button>
													</div>
												</td>
											</tr>
										))}
									</tbody>
								</table>
							</div>
						</div>
					</>
				)}
			</div>

			{/* Add Project Modal (placeholder) */}
			{showAddModal && (
				<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
					<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-6 w-full max-w-md mx-4" onClick={(e) => e.stopPropagation()}>
						<div className="flex items-center justify-between mb-4">
							<h2 className="text-lg font-semibold text-[var(--text-primary)]">New Project</h2>
							<button onClick={() => setShowAddModal(false)} className="text-slate-400 hover:text-[var(--text-primary)]">
								<FaTimes className="w-4 h-4" />
							</button>
						</div>
						<form onSubmit={handleAddProject} className="space-y-4">{error && <p role="alert" className="text-red-400">{error}</p>}
							<div>
								<label className="block text-xs text-slate-400 mb-1">Project Name</label>
								<input
									type="text"
									required
									className="w-full bg-[#1d1f33] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
									name="name" placeholder="Enter project name"
								/>
							</div>
							<div>
								<label className="block text-xs text-slate-400 mb-1">Team</label>
								<select name="teamId" required className="w-full bg-[#1d1f33] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500">
									<option value="">Select a team</option>
									{availableTeams.filter(t => !projects.some(p => p.team === t.id)).map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
								</select>
							</div>
							<div>
								<label className="block text-xs text-slate-400 mb-1">Description</label>
								<textarea
									rows={3}
									className="w-full bg-[#1d1f33] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 resize-none"
									name="description" placeholder="Brief description"
								/>
							</div>
							<div className="flex items-center justify-end gap-3 pt-2">
								<button
									type="button"
									onClick={() => setShowAddModal(false)}
									className="text-sm text-slate-400 hover:text-[var(--text-primary)] px-3 py-2 transition-colors"
								>
									Cancel
								</button>
								<button
									type="submit"
									disabled={creating}
									className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-[var(--text-primary)] text-sm px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
								>
									{creating && <FaSpinner className="w-3 h-3 animate-spin" />}
									{creating ? "Creating..." : "Create Project"}
								</button>
							</div>
						</form>
					</div>
				</div>
			)}
		</Layout>
	);
};

export default ProjectsPage;
