import {onDashboardChange} from '@/lib/socket-client';
import React, { useState, useMemo, useEffect, useCallback } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import TaskCard from "@/components/TaskCard";
import InteractiveDonut from "@/components/InteractiveDonut";
import api from "@/lib/api-client";
import type { TaskPriority, TaskStatus, Task, Member, Agent } from "@/types";
import {
	FaSearch,
	FaFilter,
	FaPlus,
	FaTasks,
	FaCheckCircle,
	FaClock,
	FaEllipsisH,
	FaChartPie,
	FaChevronDown,
	FaExclamationTriangle,
	FaTimes,
	FaSpinner,
	FaBan,
	FaTrash,
	FaEdit,
	FaUserPlus,
} from "react-icons/fa";

// ── Types ────────────────────────────────────────────────────────────────

interface TaskRow {
	id: string;
	title: string;
	description: string;
	priority: TaskPriority;
	status: TaskStatus;
	type: string;
	project: string;
	sprint: string;
	assigneeId: string;
	assignee: string;
	assigneeColor: string;
	agentId: string;
	agent?: { name: string };
	dueDate: string;
	storyPoints: number;
	progress: number;
	acceptanceCriteria: { text: string; done: boolean }[];
	attachments: number;
	relatedTasks: string[];
	blocked: boolean;
	blockedReason: string;
	teamId: string;
	projectId: string;
	dependencies: string[];
	createdAt: string;
	updatedAt: string;
	branch?: string;
	prNumber?: number;
	ciStatus?: { state: string; description?: string };
}

interface TaskRowWithCI extends TaskRow {
	ciStatus?: { state: "pending" | "success" | "failure" | "error"; description?: string };
}

// ── API Response Transformation ─────────────────────────────────────────

function transformApiTask(t: Task): TaskRowWithCI {
	const member = (t.assignee as Member | undefined);
	const agent = (t.agent as Agent | undefined);

	const assigneeName = member ? member.name : agent ? agent.name : "Unassigned";
	const assigneeColor = member
		? ["bg-blue-600", "bg-purple-600", "bg-green-600", "bg-orange-600", "bg-pink-600", "bg-cyan-600"][
			Math.abs(member.name.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 6
		 ]
		: "bg-[var(--bg-tertiary)]";

	const dueDate = t.dueDate
		? new Date(t.dueDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })
		: "";

	let rawAC: unknown = t.acceptanceCriteria;
 if(typeof rawAC === "string") {try {rawAC=JSON.parse(rawAC);}catch{}}
 if(Array.isArray(rawAC)) rawAC=rawAC.map(item => typeof item === "string" ? {text:item,done:false} : item);
	let acceptanceCriteriaList: { text: string; done: boolean }[] = [];
	if (Array.isArray(rawAC)) {
		acceptanceCriteriaList = rawAC
			.filter((item: unknown) => {
				const entry = item as Record<string, unknown>;
				return typeof entry.text === "string" && entry.text.trim().length > 0;
			})
			.map((item: unknown) => {
				const entry = item as Record<string, unknown>;
				return { text: String(entry.text).trim(), done: Boolean(entry.done) };
			});
	} else if (typeof rawAC === "string" && rawAC.trim().length > 0) {
		acceptanceCriteriaList = rawAC
			.split("\n")
			.filter((line) => line.trim().length > 0)
			.map((text) => ({ text: text.trim(), done: false }));
	}

	const progress = acceptanceCriteriaList.length > 0
		? Math.round((acceptanceCriteriaList.filter((a: { text: string; done: boolean }) => a.done).length / acceptanceCriteriaList.length) * 100)
		: 0;

	return {
		id: t.id,
		title: t.title,
		description: t.description || "",
		priority: t.priority,
		status: t.status,
		type: t.type || "Task",
		project: t.projectId || "",
		sprint: t.sprintId || "",
		assignee: assigneeName,
		assigneeColor,
		dueDate,
		storyPoints: t.storyPoints || 0,
		progress,
		acceptanceCriteria: acceptanceCriteriaList,
		attachments: 0,
		relatedTasks: t.dependencies || [],
		blocked: t.blocked || false,
		blockedReason: t.blockedReason || "",
		assigneeId: t.assigneeId || "",
		agentId: t.agentId || "",
		teamId: t.teamId,
		projectId: t.projectId || "",
		dependencies: t.dependencies || [],
		createdAt: t.createdAt,
		updatedAt: t.updatedAt,
	};
}

// ── Task Detail Form State ──────────────────────────────────────────────

interface TaskFormState {
	title: string;
	description: string;
	priority: TaskPriority;
	type: string;
	projectId: string;
	sprintId: string;
	storyPoints: number;
	dueDate: string;
	acceptanceCriteria: string;
	blocked: boolean;
	blockedReason: string;
	assigneeId: string;
}

const emptyForm: TaskFormState = {
	title: "",
	description: "",
	priority: "medium",
	type: "Task",
	projectId: "",
	sprintId: "",
	storyPoints: 0,
	dueDate: "",
	acceptanceCriteria: "",
	blocked: false,
	blockedReason: "",
	assigneeId: "",
};

// ── Constants (static, non-data) ────────────────────────────────────────

const KANBAN_COLUMNS = [
	{ id: "backlog" as TaskStatus, title: "To Do", color: "border-l-slate-500", headerBg: "bg-slate-500" },
	{ id: "in_progress" as TaskStatus, title: "In Progress", color: "border-l-blue-500", headerBg: "bg-blue-500" },
	{ id: "review" as TaskStatus, title: "Code Review", color: "border-l-yellow-500", headerBg: "bg-yellow-500" },
	{ id: "testing" as TaskStatus, title: "Testing", color: "border-l-violet-500", headerBg: "bg-violet-500" },
	{ id: "done" as TaskStatus, title: "Done", color: "border-l-green-500", headerBg: "bg-green-500" },
];

const STATS_LABELS = ["Total Tasks", "Completed", "In Progress", "Blocked", "Overdue", "On Track"];

const PRIORITY_COLORS: Record<TaskPriority, { bg: string; text: string }> = {
	low: { bg: "bg-slate-400/10", text: "text-slate-400" },
	medium: { bg: "bg-yellow-400/10", text: "text-yellow-400" },
	high: { bg: "bg-orange-400/10", text: "text-orange-400" },
	critical: { bg: "bg-red-400/10", text: "text-red-400" },
};

const PRIORITY_LABELS: Record<TaskPriority, string> = {
	low: "Low",
	medium: "Medium",
	high: "High",
	critical: "Critical",
};

const VIEW_TABS = [
	{ id: "kanban" as const, label: "Kanban" },
	{ id: "list" as const, label: "List" },
	{ id: "calendar" as const, label: "Calendar" },
	{ id: "my-tasks" as const, label: "My Tasks" },
	{ id: "reviews" as const, label: "Reviews" },
];

// ── Status helpers ──────────────────────────────────────────────────────

const statusLabel = (s: string) => {
	switch (s) {
		case "backlog": return "To Do";
		case "ready": return "Ready";
		case "in_progress": return "In Progress";
		case "review": return "Code Review";
		case "testing": return "Testing";
		case "done": return "Done";
		case "blocked": return "Blocked";
		default: return s;
	}
};

const statusClass = (s: string) => {
	switch (s) {
		case "backlog": return "bg-slate-600/20 text-slate-400";
		case "ready": return "bg-cyan-400/10 text-cyan-400";
		case "in_progress": return "bg-blue-400/10 text-blue-400";
		case "review": return "bg-yellow-400/10 text-yellow-400";
		case "testing": return "bg-violet-400/10 text-violet-400";
		case "done": return "bg-green-400/10 text-green-400";
		case "blocked": return "bg-red-400/10 text-red-400";
		default: return "bg-slate-600/20 text-slate-400";
	}
};

const DEFAULT_STATS = [
	{ label: "Total Tasks", value: "...", icon: FaTasks, color: "text-blue-400", bg: "bg-blue-400/10" },
	{ label: "Completed", value: "...", icon: FaCheckCircle, color: "text-green-400", bg: "bg-green-400/10" },
	{ label: "In Progress", value: "...", icon: FaClock, color: "text-yellow-400", bg: "bg-yellow-400/10" },
	{ label: "Blocked", value: "...", icon: FaEllipsisH, color: "text-red-400", bg: "bg-red-400/10" },
	{ label: "Overdue", value: "...", icon: FaClock, color: "text-orange-400", bg: "bg-orange-400/10" },
	{ label: "On Track", value: "...", icon: FaChartPie, color: "text-emerald-400", bg: "bg-emerald-400/10" },
];

// ── Main Component ──────────────────────────────────────────────────────

const TasksPage: React.FC = () => {
	const router = useRouter();
	const [tasks, setTasks] = useState<Task[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

	// Filter state
	const [searchQuery, setSearchQuery] = useState("");
	const [projectFilter, setProjectFilter] = useState("All Projects");
	const [teamFilter, setTeamFilter] = useState("All Teams");
	const [statusFilter, setStatusFilter] = useState("All Statuses");
	const [showFilters, setShowFilters] = useState(false);

	// View state
	const [activeView, setActiveView] = useState<"kanban" | "list" | "calendar" | "my-tasks" | "reviews">("kanban");
	const [selectedTask, setSelectedTask] = useState<TaskRowWithCI | null>(null);
	const [editingTask, setEditingTask] = useState<TaskRowWithCI | null>(null);
	const [showCreateModal, setShowCreateModal] = useState(false);
	const [showEditModal, setShowEditModal] = useState(false);
	const [submitting, setSubmitting] = useState(false);
	const [formData, setFormData] = useState<TaskFormState>(emptyForm);
 const [formTeamId,setFormTeamId]=useState('');
 const [teamOptions,setTeamOptions]=useState<{id:string;name:string}[]>([]);
 const [projectOptions,setProjectOptions]=useState<{id:string;name:string;teamId:string}[]>([]);
 const [agentOptions,setAgentOptions]=useState<{id:string;name:string;member:{teamId:string}}[]>([]);
 useEffect(()=>{Promise.all([api.getTeams(),api.getProjects(),api.getAgents()]).then(([ts,ps,ags])=>{setTeamOptions(ts);setProjectOptions(ps);setAgentOptions(ags);}).catch(e=>setError(e.message));},[]);


	const unwrap = <T,>(res: unknown): T => {
		if (Array.isArray(res)) return res as T;
		if (res && typeof res === "object" && Array.isArray((res as any).tasks)) return (res as any).tasks as T;
		if (res && typeof res === "object" && (res as any).data && Array.isArray((res as any).data.tasks)) return (res as any).data.tasks as T;
		return res as T;
	};

	// Derived: unique projects and teams from current task set
 const projects = ['All Projects', ...projectOptions.map(p=>p.id)];
 const teams = ['All Teams', ...teamOptions.map(t=>t.id)];

	const statuses = useMemo(() => {
		const list = Array.isArray(tasks) ? tasks : [];
		const set = new Set(list.map((t: any) => t.status));
		return ["All Statuses", ...Array.from(set)];
	}, [tasks]);

	// ── Fetch tasks ──────────────────────────────────────────────────────
	const fetchTasks = useCallback(async () => {
		setError(null);
		try {
			const params: Record<string, string | undefined> = {};
			if (searchQuery) params.search = searchQuery;
			if (projectFilter !== "All Projects") params.projectId = projectFilter;
			if (teamFilter !== "All Teams") params.teamId = teamFilter;
			if (statusFilter !== "All Statuses") params.status = statusFilter;
			const data = await api.getTasks(params);
			setTasks(unwrap<Task[]>(data));
		} catch (err) {
			setError(err instanceof Error ? err.message : "Failed to load tasks");
		} finally {
			setLoading(false);
		}
	}, [searchQuery, projectFilter, teamFilter, statusFilter]);

	useEffect(() => {
		fetchTasks();
 const unsubscribe = onDashboardChange(fetchTasks);
 return () => unsubscribe();
	}, [fetchTasks]);

	// Toast auto-dismiss
	useEffect(() => {
		if (!toast) return;
		const t = setTimeout(() => setToast(null), 4000);
		return () => clearTimeout(t);
	}, [toast]);

	// ── Transform API tasks into the Kanban shape ────────────────────────
	const kanbanColumns = useMemo(() => {
		const transformed: TaskRowWithCI[] = tasks.map(transformApiTask);

		return KANBAN_COLUMNS.map((col) => {
			// Map unknown statuses into backlog
			let colTasks = transformed.filter((t) => t.status === col.id);
			if (col.id === "backlog" && colTasks.length === 0) {
				colTasks = transformed.filter((t) => !["in_progress", "review", "testing", "done"].includes(t.status));
			}
			return { ...col, tasks: colTasks };
		});
	}, [tasks]);

	const allTasks = useMemo(() => tasks.map(transformApiTask), [tasks]);

	const filteredTable = useMemo(() => {
		return allTasks;
	}, [allTasks]);

	// ── Stats computed from real data ────────────────────────────────────
	const computedStats = useMemo(() => {
		const total = tasks.length;
		const done = tasks.filter((t) => t.status === "done").length;
		const inProgress = tasks.filter((t) => t.status === "in_progress").length;
		const blocked = tasks.filter((t) => t.blocked).length;
		const now = new Date();
		const overdue = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done").length;
		const onTrack = total > 0 ? Math.round(((total - blocked - overdue) / total) * 100) : 0;
		return [
			{ label: "Total Tasks", value: String(total) },
			{ label: "Completed", value: String(done) },
			{ label: "In Progress", value: String(inProgress) },
			{ label: "Blocked", value: String(blocked) },
			{ label: "Overdue", value: String(overdue) },
			{ label: "On Track", value: `${onTrack}%` },
		];
	}, [tasks]);

	// ── Handlers ────────────────────────────────────────────────────────
	const handleNavigate = (item: string) => {
		const navHref: Record<string, string> = {
			overview: "/",
			teams: "/teams",
			tasks: "/tasks",
			agents: "/agents",
			projects: "/projects",
			activity: "/activity",
			settings: "/settings",
		};
		router.push(navHref[item] || "/");
	};

	const openCreateModal = () => {
		setFormData(emptyForm);
		setShowCreateModal(true);
	};

	const openEditModal = (task: TaskRowWithCI) => {
		const apiTask = tasks.find((t) => t.id === task.id);
		setEditingTask(task);
		setFormData({
			title: apiTask?.title || task.title,
			description: apiTask?.description || task.description,
			priority: apiTask?.priority || task.priority,
			type: apiTask?.type || task.type,
			projectId: apiTask?.projectId || task.project,
			sprintId: apiTask?.sprintId || task.sprint,
			storyPoints: apiTask?.storyPoints || task.storyPoints,
			dueDate: apiTask?.dueDate?.slice(0,10) || "",
			acceptanceCriteria: task.acceptanceCriteria.map(ac => ac.text).join("\n"),
			blocked: apiTask?.blocked ?? task.blocked,
			blockedReason: apiTask?.blockedReason || task.blockedReason,
			assigneeId: apiTask?.assigneeId || "",
		});
		setShowEditModal(true);
	};

	const closeModals = () => {
		setShowCreateModal(false);
		setShowEditModal(false);
		setEditingTask(null);
		setFormData(emptyForm);
	};

	const handleCreateTask = async () => {
		if (!formData.title.trim()) return;
		setSubmitting(true);
		try {
			const acceptanceArray = formData.acceptanceCriteria
				.split("\n")
				.filter((l) => l.trim())
				.map((text) => ({ text: text.trim(), done: false }));
			const created = await api.createTask({
				title: formData.title,
				description: formData.description || undefined,
				priority: formData.priority,
				status: "backlog",
				teamId: formTeamId || (teamFilter === "All Teams" ? "" : teamFilter),
				projectId: formData.projectId || undefined,
				sprintId: formData.sprintId || undefined,
				type: formData.type,
				storyPoints: formData.storyPoints || undefined,
				dueDate: formData.dueDate || undefined,
				acceptanceCriteria: acceptanceArray,
				blocked: formData.blocked,
				blockedReason: formData.blockedReason || undefined,
				assigneeId: formData.assigneeId || undefined,
			});
			setTasks((prev) => [created, ...prev]);
			setToast({ type: "success", message: `Task "${created.title}" created.` });
			closeModals();
		} catch (err) {
			setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to create task" });
		} finally {
			setSubmitting(false);
		}
	};

	const handleUpdateTask = async () => {
		if (!editingTask || !formData.title.trim()) return;
		setSubmitting(true);
		try {
			const updatePayload: Record<string, unknown> = {
				title: formData.title,
				description: formData.description || undefined,
				priority: formData.priority,
				type: formData.type,
				projectId: formData.projectId || undefined,
				sprintId: formData.sprintId || undefined,
				storyPoints: formData.storyPoints || undefined,
				dueDate: formData.dueDate || undefined,
				acceptanceCriteria: formData.acceptanceCriteria
					? formData.acceptanceCriteria
						.split("\n")
						.filter((l) => l.trim())
						.map((text) => ({ text: text.trim(), done: false }))
					: undefined,
				blocked: formData.blocked,
				blockedReason: formData.blockedReason || undefined,
			};
			const updated = await api.updateTask(editingTask.id, updatePayload);
			setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)));
			setToast({ type: "success", message: `Task "${updated.title}" updated.` });
			closeModals();
			setSelectedTask((prev) => (prev && prev.id === updated.id ? transformApiTask(updated) : prev));
		} catch (err) {
			setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to update task" });
		} finally {
			setSubmitting(false);
		}
	};

	const handleStatusChange = async (taskId: string, newStatus: string, blockedReason?: string) => {
		try {
			await api.updateTaskStatus(taskId, newStatus, blockedReason);
			setTasks((prev) =>
				prev.map((t) => (t.id === taskId ? { ...t, status: newStatus as Task["status"], blocked: newStatus === "blocked", blockedReason: blockedReason ?? t.blockedReason } : t))
			);
			setToast({ type: "success", message: `Task moved to ${statusLabel(newStatus)}.` });
		} catch (err) {
			setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to update status" });
		}
	};

	const handleAssignTask = async (taskId: string, assigneeId?: string, agentId?: string) => {
		try {
			await api.assignTask(taskId, assigneeId, agentId);
			setToast({ type: "success", message: "Assignment updated." });
		} catch (err) {
			setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to assign task" });
		}
	};

	const handleDeleteTask = async (taskId: string) => {
		try {
			await api.deleteTask(taskId);
			setTasks((prev) => prev.filter((t) => t.id !== taskId));
			setSelectedTask((prev) => (prev && prev.id === taskId ? null : prev));
			setToast({ type: "success", message: "Task deleted." });
		} catch (err) {
			setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to delete task" });
		}
	};

	// ── Toast ────────────────────────────────────────────────────────────
	const toastEl = toast ? (
		<div
			className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-lg shadow-lg flex items-center gap-2 text-sm font-medium ${
				toast.type === "success" ? "bg-green-500/90 text-[var(--text-primary)]" : "bg-red-500/90 text-[var(--text-primary)]"
			}`}
		>
			{toast.type === "success" ? <FaCheckCircle className="w-4 h-4" /> : <FaExclamationTriangle className="w-4 h-4" />}
			<span>{toast.message}</span>
			<button onClick={() => setToast(null)} className="ml-2 hover:opacity-80">
				<FaTimes className="w-3 h-3" />
			</button>
		</div>
	) : null;

	// ── Loading State ────────────────────────────────────────────────────
	if (loading) {
		return (
			<Layout activeNav="tasks" onNavigate={handleNavigate}>
				<div className="flex items-center justify-center h-[60vh]">
					<div className="flex flex-col items-center gap-3">
						<FaSpinner className="w-8 h-8 text-blue-400 animate-spin" />
						<p className="text-slate-400 text-sm">Loading tasks...</p>
					</div>
				</div>
			</Layout>
		);
	}

	// ── Error State ──────────────────────────────────────────────────────
	if (error) {
		return (
			<Layout activeNav="tasks" onNavigate={handleNavigate}>
				<div className="flex items-center justify-center h-[60vh]">
					<div className="flex flex-col items-center gap-3 max-w-md text-center">
						<FaExclamationTriangle className="w-8 h-8 text-red-400" />
						<p className="text-[var(--text-primary)] font-medium">Failed to load tasks</p>
						<p className="text-sm text-slate-400">{error}</p>
						<button
							onClick={fetchTasks}
							className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-md transition-colors"
						>
							Retry
						</button>
					</div>
				</div>
			</Layout>
		);
	}

	// ── Render ──────────────────────────────────────────────────────────
	return (
		<Layout activeNav="tasks" onNavigate={handleNavigate}>
			{toastEl}
			<div className="px-6 space-y-6">
				{/* ── Page Header ─────────────────────────────────────────── */}
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
					<div>
						<h1 className="text-2xl font-bold text-[var(--text-primary)]">Tasks</h1>
						<p className="text-sm text-slate-400 mt-1">Manage and track tasks across all projects and teams.</p>
					</div>
					<div className="flex flex-wrap items-center gap-3">
						{/* Search */}
						<div className="relative">
							<FaSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500 text-xs" />
							<input
								type="text"
								placeholder="Search tasks..."
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								className="w-64 bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md pl-9 pr-4 py-2 text-sm text-[var(--text-primary)] placeholder:text-slate-500 focus:outline-none focus:border-blue-500"
							/>
						</div>

						{/* Project filter */}
						<select
							value={projectFilter}
							onChange={(e) => setProjectFilter(e.target.value)}
							className="bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
						>
							{projects.map((p) => (
								<option key={p} value={p}>{projectOptions.find(o=>o.id===p)?.name || p}</option>
							))}
						</select>

						{/* Team filter */}
						<select
							value={teamFilter}
							onChange={(e) => setTeamFilter(e.target.value)}
							className="bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
						>
							{teams.map((t) => (
								<option key={t} value={t}>{teamOptions.find(o=>o.id===t)?.name || t}</option>
							))}
						</select>

						{/* Status filter */}
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
						>
							{statuses.map((s) => (
								<option key={s} value={s}>{s}</option>
							))}
						</select>

						{/* Filters toggle */}
						<button
							onClick={() => setShowFilters(!showFilters)}
							className="bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 hover:text-[var(--text-primary)] flex items-center gap-2 transition-colors"
						>
							<FaFilter className="w-3 h-3" />
							Filters
							<FaChevronDown className={`w-3 h-3 transition-transform ${showFilters ? "rotate-180" : ""}`} />
						</button>

						{/* Create Task */}
						<button
							onClick={openCreateModal}
							className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-md flex items-center gap-2 transition-colors"
						>
							<FaPlus className="w-3 h-3" />
							Create Task
						</button>
					</div>
				</div>

				{/* ── Stats Row ───────────────────────────────────────────── */}
				<div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
					{computedStats.map((s, idx) => (
						<div key={s.label} className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
							<div className="flex items-start justify-between">
								<div>
									<p className="text-xs text-slate-400 mb-1">{s.label}</p>
									<p className="text-xl font-bold text-[var(--text-primary)]">{s.value}</p>
								</div>
								<div className={`p-2 rounded-lg ${DEFAULT_STATS[idx].bg} ${DEFAULT_STATS[idx].color}`}>
									{(() => {
										const I = DEFAULT_STATS[idx].icon;
										return <I className="w-4 h-4" />;
									})()}
								</div>
							</div>
						</div>
					))}
				</div>

				{/* ── View Tabs ───────────────────────────────────────────── */}
				<div className="flex items-center gap-1 border-b border-[var(--border-default)]">
					{VIEW_TABS.map((tab) => (
						<button
							key={tab.id}
							onClick={() => setActiveView(tab.id)}
							className={`px-4 py-2.5 text-sm font-medium transition-colors ${
								activeView === tab.id
									? "text-blue-400 border-b-2 border-blue-500"
									: "text-slate-400 hover:text-[var(--text-primary)]"
							}`}
						>
							{tab.label}
						</button>
					))}
				</div>

				{/* ── Main Content: Kanban + Right Panel ──────────────────── */}
				<div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
					{/* LEFT: Kanban Board */}
					<div className={selectedTask ? "xl:col-span-3" : "xl:col-span-4"}>
						{activeView === "kanban" && (
							<div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
								{kanbanColumns.map((col) => (
									<div
										key={col.id}
										className={`kanban-column flex-shrink-0 w-72 flex flex-col ${col.color}`}
									>
										{/* Column Header */}
										<div className="px-3 py-2.5 rounded-t-lg flex items-center justify-between" style={{ backgroundColor: col.headerBg }}>
											<h3 className="text-sm font-semibold text-[var(--text-primary)]">{col.title}</h3>
											<span className="text-xs text-[var(--text-primary)]/70 bg-white/10 px-2 py-0.5 rounded-full">
												{col.tasks.length}
											</span>
										</div>

										{/* Tasks */}
										<div className="flex-1 overflow-y-auto scrollbar-thin p-2.5 space-y-2.5">
											{col.tasks.map((task) => (
												<div
													key={task.id}
													onClick={() => setSelectedTask(task)}
													className="cursor-pointer group"
												>
													<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-md p-3 hover:border-slate-600 transition-colors">
														{/* Type badge */}
														<span className="text-[10px] px-1.5 py-0.5 rounded bg-[var(--bg-tertiary)]/60 text-slate-300 uppercase tracking-wide mb-1.5 inline-block">
															{task.type}
														</span>
														{/* TaskCard */}
														<TaskCard task={task as unknown as import("@/types").TaskWithCI} onClick={() => {}} showAssignee compact />
														{/* Due date */}
														<div className="flex items-center gap-1 text-[11px] text-slate-500 mt-2">
															<FaClock className="w-3 h-3" />
															{task.dueDate}
														</div>
														{/* Progress bar */}
														<div className="mt-2">
															<div className="w-full bg-[var(--bg-tertiary)]/60 rounded-full h-1.5">
																<div
																	className="bg-blue-500 h-1.5 rounded-full transition-all"
																	style={{ width: `${task.progress}%` }}
																/>
															</div>
															<div className="flex items-center justify-between mt-0.5">
																<span className="text-[10px] text-slate-500">Progress</span>
																<span className="text-[10px] text-slate-400">{task.progress}%</span>
															</div>
														</div>
													</div>
												</div>
											))}
											{col.tasks.length === 0 && (
												<div className="text-center py-8 text-slate-600 text-xs">No tasks</div>
											)}
										</div>
									</div>
								))}
							</div>
						)}

						{activeView === "list" && (
							<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="text-xs text-slate-500 border-b border-[var(--border-default)]">
												<th className="text-left px-4 py-3 font-medium">Task</th>
												<th className="text-left px-4 py-3 font-medium">Type</th>
												<th className="text-left px-4 py-3 font-medium">Priority</th>
												<th className="text-left px-4 py-3 font-medium">Status</th>
												<th className="text-left px-4 py-3 font-medium">Assignee</th>
												<th className="text-left px-4 py-3 font-medium">Due Date</th>
												<th className="text-left px-4 py-3 font-medium">Progress</th>
												<th className="text-left px-4 py-3 font-medium">Actions</th>
											</tr>
										</thead>
										<tbody>
											{filteredTable.map((task) => {
												const pStyle = PRIORITY_COLORS[task.priority];
												return (
													<tr
														key={task.id}
														onClick={() => setSelectedTask(task)}
														className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-secondary)]/30 cursor-pointer"
													>
														<td className="px-4 py-3">
															<div>
																<p className="text-[var(--text-primary)] font-medium text-sm">{task.title}</p>
																<p className="text-slate-500 text-xs truncate max-w-xs">{task.project}</p>
															</div>
														</td>
														<td className="px-4 py-3">
															<span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)]/50 text-slate-300">
																{task.type}
															</span>
														</td>
														<td className="px-4 py-3">
															<span className={`text-xs px-2 py-0.5 rounded-full ${pStyle.bg} ${pStyle.text}`}>
																{PRIORITY_LABELS[task.priority]}
															</span>
														</td>
														<td className="px-4 py-3">
															<span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(task.status)}`}>
																{statusLabel(task.status)}
															</span>
														</td>
														<td className="px-4 py-3">
															<div className="flex items-center gap-2">
																<div className={`w-6 h-6 rounded-full ${task.assigneeColor} flex items-center justify-center text-[var(--text-primary)] text-[10px] font-bold`}>
																	{task.assignee.split(" ").map((n) => n[0]).join("")}
																</div>
																<span className="text-slate-400 text-xs">{task.assignee}</span>
															</div>
														</td>
														<td className="px-4 py-3 text-slate-400 text-xs">{task.dueDate}</td>
														<td className="px-4 py-3">
															<div className="flex items-center gap-2">
																<div className="w-16 bg-[var(--bg-tertiary)] rounded-full h-1.5">
																	<div
																		className="bg-blue-500 h-1.5 rounded-full"
																		style={{ width: `${task.progress}%` }}
																	/>
																</div>
																<span className="text-xs text-slate-400">{task.progress}%</span>
															</div>
														</td>
														<td className="px-4 py-3">
															<button
																onClick={(e) => { e.stopPropagation(); openEditModal(task); }}
																className="text-slate-400 hover:text-[var(--text-primary)] transition-colors mr-2"
															>
																<FaEdit className="w-4 h-4" />
															</button>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>
						)}

						{(activeView === "calendar" || activeView === "my-tasks" || activeView === "reviews") && (
							<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-12 text-center">
								<FaTasks className="w-12 h-12 text-slate-600 mx-auto mb-3" />
								<p className="text-slate-400 text-sm">
									{activeView === "calendar" && "Calendar view is coming soon."}
									{activeView === "my-tasks" && "My Tasks view shows only tasks assigned to you."}
									{activeView === "reviews" && "Code Reviews view shows tasks awaiting review."}
								</p>
							</div>
						)}

						{/* ── Bottom Section: Task List Table + Donut + Priority ── */}
						<div className="grid grid-cols-1 xl:grid-cols-4 gap-6 mt-6">
							{/* Task List Table */}
							<div className="xl:col-span-3 bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
								<div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
									<h3 className="text-sm font-semibold text-[var(--text-primary)]">All Tasks</h3>
									<span className="text-xs text-slate-500">{filteredTable.length} tasks</span>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full text-sm">
										<thead>
											<tr className="text-xs text-slate-500 border-b border-[var(--border-default)]">
												<th className="text-left px-4 py-2.5 font-medium w-8">#</th>
												<th className="text-left px-4 py-2.5 font-medium">Task</th>
												<th className="text-left px-4 py-2.5 font-medium">Project</th>
												<th className="text-left px-4 py-2.5 font-medium">Priority</th>
												<th className="text-left px-4 py-2.5 font-medium">Due Date</th>
												<th className="text-left px-4 py-2.5 font-medium">Status</th>
												<th className="text-left px-4 py-2.5 font-medium">Assignee</th>
											</tr>
										</thead>
										<tbody>
											{filteredTable.map((task, idx) => {
												const pStyle = PRIORITY_COLORS[task.priority];
												return (
													<tr
														key={task.id}
														onClick={() => setSelectedTask(task)}
														className="border-b border-[var(--border-default)]/50 hover:bg-[var(--bg-secondary)]/30 cursor-pointer"
													>
														<td className="px-4 py-3 text-slate-500 text-xs">{idx + 1}</td>
														<td className="px-4 py-3 text-[var(--text-primary)] font-medium text-sm">{task.title}</td>
														<td className="px-4 py-3 text-slate-400 text-xs">{task.project}</td>
														<td className="px-4 py-3">
															<span className={`text-xs px-2 py-0.5 rounded-full ${pStyle.bg} ${pStyle.text}`}>
																{PRIORITY_LABELS[task.priority]}
															</span>
														</td>
														<td className="px-4 py-3 text-slate-400 text-xs">{task.dueDate}</td>
														<td className="px-4 py-3">
															<span className={`text-xs px-2 py-0.5 rounded-full ${statusClass(task.status)}`}>
																{statusLabel(task.status)}
															</span>
														</td>
														<td className="px-4 py-3">
															<div className="flex items-center gap-2">
																<div className={`w-5 h-5 rounded-full ${task.assigneeColor} flex items-center justify-center text-[var(--text-primary)] text-[9px] font-bold`}>
																	{task.assignee.split(" ").map((n) => n[0]).join("")}
																</div>
																<span className="text-slate-400 text-xs">{task.assignee}</span>
															</div>
														</td>
													</tr>
												);
											})}
										</tbody>
									</table>
								</div>
							</div>

							{/* RIGHT: Donut + Priority Breakdown */}
							<div className="xl:col-span-1 space-y-6">
								{/* Task Distribution Donut */}
								<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
									<h3 className="text-[var(--text-primary)] text-sm font-semibold mb-3">Task Distribution</h3>
									<InteractiveDonut
										segments={[
											{ label: "Feature", value: 48, color: "#3b82f6" },
											{ label: "Bug", value: 28, color: "#ef4444" },
											{ label: "Refactor", value: 22, color: "#f97316" },
											{ label: "Docs", value: 12, color: "#94a3b8" },
											{ label: "Testing", value: 14, color: "#22c55e" },
										]}
										size={140}
										strokeWidth={18}
										centerLabel="Tasks"
										showLegend={true}
									/>
								</div>

								{/* Tasks by Priority */}
								<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
									<h3 className="text-[var(--text-primary)] text-sm font-semibold mb-3">Tasks by Priority</h3>
									<div className="space-y-3">
										{[
											{ label: "Critical", value: tasks.filter((t) => t.priority === "critical").length, color: "#ef4444" },
											{ label: "High", value: tasks.filter((t) => t.priority === "high").length, color: "#f97316" },
											{ label: "Medium", value: tasks.filter((t) => t.priority === "medium").length, color: "#fbbf24" },
											{ label: "Low", value: tasks.filter((t) => t.priority === "low").length, color: "#94a3b8" },
										].map((item) => {
											const maxVal = Math.max(...tasks.map((t) => t.priority === item.label.toLowerCase() ? 1 : 0), 1);
											return (
												<div key={item.label}>
													<div className="flex items-center justify-between text-xs mb-1">
														<div className="flex items-center gap-2">
															<span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: item.color }} />
															<span className="text-slate-300">{item.label}</span>
														</div>
														<span className="text-slate-400 font-medium">{item.value}</span>
													</div>
													<div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2">
														<div
															className="h-2 rounded-full transition-all"
															style={{
																width: `${tasks.length > 0 ? (item.value / tasks.length) * 100 : 0}%`,
																backgroundColor: item.color,
															}}
														/>
													</div>
												</div>
											);
										})}
									</div>
								</div>
							</div>
						</div>
					</div>

					{/* RIGHT: Task Detail Panel */}
					{selectedTask && (
						<div className="xl:col-span-1 space-y-0">
							<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
								{/* Panel Header */}
								<div className="px-4 py-3 border-b border-[var(--border-default)] flex items-center justify-between">
									<h3 className="text-[var(--text-primary)] text-sm font-semibold">Task Detail</h3>
									<div className="flex items-center gap-1">
										<button
											onClick={() => openEditModal(selectedTask)}
											className="text-slate-400 hover:text-[var(--text-primary)] transition-colors p-1"
											title="Edit task"
										>
											<FaEdit className="w-4 h-4" />
										</button>
										<button
											onClick={() => handleDeleteTask(selectedTask.id)}
											className="text-slate-400 hover:text-red-400 transition-colors p-1"
											title="Delete task"
										>
											<FaTrash className="w-4 h-4" />
										</button>
										<button
											onClick={() => setSelectedTask(null)}
											className="text-slate-400 hover:text-[var(--text-primary)] transition-colors p-1"
										>
											<FaTimes className="w-4 h-4" />
										</button>
									</div>
								</div>

								<div className="p-4 space-y-4 max-h-[calc(100vh-200px)] overflow-y-auto scrollbar-thin">
									{/* Project & Sprint */}
									<div>
										<p className="text-xs text-slate-500 mb-1">Project</p>
										<p className="text-sm text-[var(--text-primary)] font-medium">{selectedTask.project}</p>
										<p className="text-xs text-slate-400 mt-0.5">Sprint: {selectedTask.sprint}</p>
									</div>

									<label className="block text-sm text-slate-300">Team *<select aria-label="Task team" className="input-field w-full" value={formTeamId} onChange={e=>setFormTeamId(e.target.value)}><option value="">Select team</option>{teamOptions.map(t=><option key={t.id} value={t.id}>{t.name}</option>)}</select></label>
 {/* Title */}
									<div>
										<p className="text-xs text-slate-500 mb-1">Title</p>
										<p className="text-sm text-[var(--text-primary)]">{selectedTask.title}</p>
									</div>

									{/* Assignee */}
									<div>
										<p className="text-xs text-slate-500 mb-1">Assignee</p>
										<div className="flex items-center gap-2">
											<div className={`w-6 h-6 rounded-full ${selectedTask.assigneeColor} flex items-center justify-center text-[var(--text-primary)] text-[10px] font-bold`}>
												{selectedTask.assignee.split(" ").map((n) => n[0]).join("")}
											</div>
											<span className="text-sm text-slate-300">{selectedTask.assignee}</span>
										</div>
									</div>

									{/* Priority + Type */}
									<div className="grid grid-cols-2 gap-3">
										<div>
											<p className="text-xs text-slate-500 mb-1">Priority</p>
											<span className={`text-xs px-2 py-0.5 rounded-full ${PRIORITY_COLORS[selectedTask.priority].bg} ${PRIORITY_COLORS[selectedTask.priority].text}`}>
												{PRIORITY_LABELS[selectedTask.priority]}
											</span>
										</div>
										<div>
											<p className="text-xs text-slate-500 mb-1">Type</p>
											<span className="text-xs px-2 py-0.5 rounded-full bg-[var(--bg-tertiary)]/50 text-slate-300">
												{selectedTask.type}
											</span>
										</div>
									</div>

									{/* Story Points + Due Date */}
									<div className="grid grid-cols-2 gap-3">
										<div>
											<p className="text-xs text-slate-500 mb-1">Story Points</p>
											<p className="text-sm text-[var(--text-primary)] font-medium">{selectedTask.storyPoints}</p>
										</div>
										<div>
											<p className="text-xs text-slate-500 mb-1">Due Date</p>
											<p className="text-sm text-[var(--text-primary)]">{selectedTask.dueDate}</p>
										</div>
									</div>

									{/* Status change */}
									<div>
										<p className="text-xs text-slate-500 mb-1">Status</p>
										<select
											value={selectedTask.status}
											onChange={(e) => handleStatusChange(selectedTask.id, e.target.value)}
											className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-1.5 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
										>
											{KANBAN_COLUMNS.map((col) => (
												<option key={col.id} value={col.id}>{col.title}</option>
											))}
											<option value="ready">Ready</option>
											<option value="blocked">Blocked</option>
										</select>
										{selectedTask.blocked && selectedTask.blockedReason && (
											<p className="text-xs text-red-400 mt-1 flex items-center gap-1">
												<FaBan className="w-3 h-3" />
												{selectedTask.blockedReason}
											</p>
										)}
									</div>

									{/* Description */}
									<div>
										<p className="text-xs text-slate-500 mb-1">Description</p>
										<p className="text-sm text-slate-300 leading-relaxed">{selectedTask.description}</p>
									</div>

									{/* Acceptance Criteria */}
									<div>
										<p className="text-xs text-slate-500 mb-2">Acceptance Criteria</p>
										<div className="space-y-1.5">
											{selectedTask.acceptanceCriteria.map((ac, i) => (
												<label key={i} className="flex items-start gap-2 cursor-pointer">
													<input
														type="checkbox"
														checked={ac.done}
														readOnly
														className="mt-0.5 w-3.5 h-3.5 rounded border-slate-600 bg-[var(--bg-secondary)] text-blue-500 focus:ring-blue-500"
													/>
													<span className={`text-xs ${ac.done ? "text-slate-500 line-through" : "text-slate-300"}`}>
														{ac.text}
													</span>
												</label>
											))}
										</div>
									</div>

									{/* Attachments */}
									<div>
										<p className="text-xs text-slate-500 mb-1">Attachments</p>
										<p className="text-sm text-slate-300">{selectedTask.attachments} files attached</p>
									</div>

									{/* Related Items */}
									{selectedTask.relatedTasks.length > 0 && (
										<div>
											<p className="text-xs text-slate-500 mb-1">Related Items</p>
											<div className="space-y-1">
												{selectedTask.relatedTasks.map((rid) => {
													const rel = allTasks.find((t) => t.id === rid);
													if (!rel) return null;
													return (
														<button
															key={rid}
															onClick={() => setSelectedTask(rel)}
															className="w-full text-left text-xs text-blue-400 hover:text-blue-300 bg-[var(--bg-secondary)]/50 rounded px-2 py-1.5 transition-colors"
														>
															{rel.id}: {rel.title}
														</button>
													);
												})}
											</div>
										</div>
									)}

									<label className="block text-sm text-slate-300">Assign AI agent<select aria-label="Assign AI agent" className="input-field w-full" value={tasks.find(t=>t.id===selectedTask.id)?.agentId || ''} onChange={e=>handleAssignTask(selectedTask.id,undefined,e.target.value || undefined)}><option value="">Unassigned</option>{agentOptions.filter(a=>a.member.teamId===tasks.find(t=>t.id===selectedTask.id)?.teamId).map(a=><option key={a.id} value={a.id}>{a.name}</option>)}</select></label>
 {/* Blocked reason */}
									{selectedTask.blocked && selectedTask.blockedReason && (
										<div className="bg-red-400/10 border border-red-400/20 rounded-md p-3">
											<p className="text-xs text-red-400 font-medium mb-1 flex items-center gap-1">
												<FaBan className="w-3 h-3" />
												Blocked
											</p>
											<p className="text-xs text-red-300">{selectedTask.blockedReason}</p>
										</div>
									)}
								</div>
							</div>
						</div>
					)}
				</div>
			</div>

			{/* ── Create Task Modal ────────────────────────────────────────── */}
			{showCreateModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl w-full max-w-lg mx-4 shadow-2xl">
						<div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
							<h3 className="text-[var(--text-primary)] font-semibold">Create Task</h3>
							<button onClick={closeModals} className="text-slate-400 hover:text-[var(--text-primary)] transition-colors">
								<FaTimes className="w-4 h-4" />
							</button>
						</div>
						<div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
							{/* Title */}
							<div>
								<label className="block text-xs text-slate-400 mb-1">Title *</label>
								<input
									type="text"
									value={formData.title}
									onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
									className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
									placeholder="Task title"
								/>
							</div>
							{/* Description */}
							<div>
								<label className="block text-xs text-slate-400 mb-1">Description</label>
								<textarea
									value={formData.description}
									onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
									className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 resize-none"
									rows={3}
									placeholder="Task description"
								/>
							</div>
							{/* Row: Priority, Type, Story Points */}
							<div className="grid grid-cols-3 gap-3">
								<div>
									<label className="block text-xs text-slate-400 mb-1">Priority</label>
									<select
										value={formData.priority}
										onChange={(e) => setFormData((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
									>
										{Object.entries(PRIORITY_LABELS).map(([k, v]) => (
											<option key={k} value={k}>{v}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs text-slate-400 mb-1">Type</label>
									<select
										value={formData.type}
										onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
									>
										{["Task", "Bug", "Feature", "Chore", "Refactor", "Documentation", "Testing", "Design", "Infrastructure"].map((t) => (
											<option key={t} value={t}>{teamOptions.find(o=>o.id===t)?.name || t}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs text-slate-400 mb-1">Story Points</label>
									<input
										type="number"
										min={0}
										value={formData.storyPoints || ""}
										onChange={(e) => setFormData((f) => ({ ...f, storyPoints: parseInt(e.target.value) || 0 }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
										placeholder="0"
									/>
								</div>
							</div>
							{/* Row: Project, Sprint, Due Date */}
							<div className="grid grid-cols-3 gap-3">
								<div>
									<label className="block text-xs text-slate-400 mb-1">Project</label>
									<select
										value={formData.projectId}
										onChange={(e) => setFormData((f) => ({ ...f, projectId: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
									>
										<option value="">Select project</option>
										{projects.filter((p) => p !== "All Projects").map((p) => (
											<option key={p} value={p}>{projectOptions.find(o=>o.id===p)?.name || p}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs text-slate-400 mb-1">Sprint</label>
									<input
										type="text"
										value={formData.sprintId}
										onChange={(e) => setFormData((f) => ({ ...f, sprintId: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
										placeholder="Sprint name"
									/>
								</div>
								<div>
									<label className="block text-xs text-slate-400 mb-1">Due Date</label>
									<input
										type="date"
										value={formData.dueDate}
										onChange={(e) => setFormData((f) => ({ ...f, dueDate: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
									/>
								</div>
							</div>
							{/* Acceptance Criteria */}
							<div>
								<label className="block text-xs text-slate-400 mb-1">Acceptance Criteria (one per line)</label>
								<textarea
									value={formData.acceptanceCriteria}
									onChange={(e) => setFormData((f) => ({ ...f, acceptanceCriteria: e.target.value }))}
									className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 resize-none"
									rows={3}
									placeholder="- First criterion&#10;- Second criterion"
								/>
							</div>
							{/* Blocked */}
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="blocked-create"
									checked={formData.blocked}
									onChange={(e) => setFormData((f) => ({ ...f, blocked: e.target.checked }))}
									className="w-4 h-4 rounded border-slate-600 bg-[var(--bg-secondary)] text-blue-500 focus:ring-blue-500"
								/>
								<label htmlFor="blocked-create" className="text-xs text-slate-300">Blocked</label>
							</div>
							{formData.blocked && (
								<div>
									<label className="block text-xs text-slate-400 mb-1">Blocked Reason</label>
									<input
										type="text"
										value={formData.blockedReason}
										onChange={(e) => setFormData((f) => ({ ...f, blockedReason: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
										placeholder="Why is this blocked?"
									/>
								</div>
							)}
						</div>
						<div className="px-6 py-4 border-t border-[var(--border-default)] flex items-center justify-end gap-3">
							<button
								onClick={closeModals}
								className="text-sm text-slate-400 hover:text-[var(--text-primary)] px-4 py-2 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={handleCreateTask}
								disabled={submitting || !formData.title.trim()}
								className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
							>
								{submitting && <FaSpinner className="w-3 h-3 animate-spin" />}
								Create Task
							</button>
						</div>
					</div>
				</div>
			)}

			{/* ── Edit Task Modal ──────────────────────────────────────────── */}
			{showEditModal && (
				<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
					<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-xl w-full max-w-lg mx-4 shadow-2xl">
						<div className="px-6 py-4 border-b border-[var(--border-default)] flex items-center justify-between">
							<h3 className="text-[var(--text-primary)] font-semibold">Edit Task</h3>
							<button onClick={closeModals} className="text-slate-400 hover:text-[var(--text-primary)] transition-colors">
								<FaTimes className="w-4 h-4" />
							</button>
						</div>
						<div className="p-6 space-y-4 max-h-[60vh] overflow-y-auto scrollbar-thin">
							{/* Title */}
							<div>
								<label className="block text-xs text-slate-400 mb-1">Title *</label>
								<input
									type="text"
									value={formData.title}
									onChange={(e) => setFormData((f) => ({ ...f, title: e.target.value }))}
									className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
								/>
							</div>
							{/* Description */}
							<div>
								<label className="block text-xs text-slate-400 mb-1">Description</label>
								<textarea
									value={formData.description}
									onChange={(e) => setFormData((f) => ({ ...f, description: e.target.value }))}
									className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 resize-none"
									rows={3}
								/>
							</div>
							{/* Row: Priority, Type, Story Points */}
							<div className="grid grid-cols-3 gap-3">
								<div>
									<label className="block text-xs text-slate-400 mb-1">Priority</label>
									<select
										value={formData.priority}
										onChange={(e) => setFormData((f) => ({ ...f, priority: e.target.value as TaskPriority }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
									>
										{Object.entries(PRIORITY_LABELS).map(([k, v]) => (
											<option key={k} value={k}>{v}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs text-slate-400 mb-1">Type</label>
									<select
										value={formData.type}
										onChange={(e) => setFormData((f) => ({ ...f, type: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
									>
										{["Task", "Bug", "Feature", "Chore", "Refactor", "Documentation", "Testing", "Design", "Infrastructure"].map((t) => (
											<option key={t} value={t}>{teamOptions.find(o=>o.id===t)?.name || t}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs text-slate-400 mb-1">Story Points</label>
									<input
										type="number"
										min={0}
										value={formData.storyPoints || ""}
										onChange={(e) => setFormData((f) => ({ ...f, storyPoints: parseInt(e.target.value) || 0 }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
									/>
								</div>
							</div>
							{/* Row: Project, Sprint, Due Date */}
							<div className="grid grid-cols-3 gap-3">
								<div>
									<label className="block text-xs text-slate-400 mb-1">Project</label>
									<select
										value={formData.projectId}
										onChange={(e) => setFormData((f) => ({ ...f, projectId: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-300 focus:outline-none focus:border-blue-500"
									>
										<option value="">Select project</option>
										{projects.filter((p) => p !== "All Projects").map((p) => (
											<option key={p} value={p}>{projectOptions.find(o=>o.id===p)?.name || p}</option>
										))}
									</select>
								</div>
								<div>
									<label className="block text-xs text-slate-400 mb-1">Sprint</label>
									<input
										type="text"
										value={formData.sprintId}
										onChange={(e) => setFormData((f) => ({ ...f, sprintId: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
									/>
								</div>
								<div>
									<label className="block text-xs text-slate-400 mb-1">Due Date</label>
									<input
										type="date"
										value={formData.dueDate}
										onChange={(e) => setFormData((f) => ({ ...f, dueDate: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
									/>
								</div>
							</div>
							{/* Acceptance Criteria */}
							<div>
								<label className="block text-xs text-slate-400 mb-1">Acceptance Criteria (one per line)</label>
								<textarea
									value={formData.acceptanceCriteria}
									onChange={(e) => setFormData((f) => ({ ...f, acceptanceCriteria: e.target.value }))}
									className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500 resize-none"
									rows={3}
								/>
							</div>
							{/* Blocked */}
							<div className="flex items-center gap-2">
								<input
									type="checkbox"
									id="blocked-edit"
									checked={formData.blocked}
									onChange={(e) => setFormData((f) => ({ ...f, blocked: e.target.checked }))}
									className="w-4 h-4 rounded border-slate-600 bg-[var(--bg-secondary)] text-blue-500 focus:ring-blue-500"
								/>
								<label htmlFor="blocked-edit" className="text-xs text-slate-300">Blocked</label>
							</div>
							{formData.blocked && (
								<div>
									<label className="block text-xs text-slate-400 mb-1">Blocked Reason</label>
									<input
										type="text"
										value={formData.blockedReason}
										onChange={(e) => setFormData((f) => ({ ...f, blockedReason: e.target.value }))}
										className="w-full bg-[var(--surface-input)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] focus:outline-none focus:border-blue-500"
									/>
								</div>
							)}
						</div>
						<div className="px-6 py-4 border-t border-[var(--border-default)] flex items-center justify-end gap-3">
							<button
								onClick={closeModals}
								className="text-sm text-slate-400 hover:text-[var(--text-primary)] px-4 py-2 transition-colors"
							>
								Cancel
							</button>
							<button
								onClick={handleUpdateTask}
								disabled={submitting || !formData.title.trim()}
								className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
							>
								{submitting && <FaSpinner className="w-3 h-3 animate-spin" />}
								Save Changes
							</button>
						</div>
					</div>
				</div>
			)}
		</Layout>
	);
};

export default TasksPage;
