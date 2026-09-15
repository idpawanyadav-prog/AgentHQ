import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import api from "@/lib/api-client";
import { Member, Team } from "@/types";
import {
 FaSearch,
 FaPlus,
 FaUserCircle,
 FaCircle,
 FaCheckSquare,
 FaTimesCircle,
 FaCheckCircle,
 FaMicrochip,
 FaTasks,
 FaUsers,
 FaTrash,
 FaEdit,
} from "react-icons/fa";

import InteractiveDonut from "@/components/InteractiveDonut";

// --- Helpers -------------------------------------------------------

const ROLE_COLORS: Record<string, string> = {
 Designer: "bg-purple-500/15 text-purple-300 border-purple-500/30",
 "Business Analyst": "bg-blue-500/15 text-blue-300 border-blue-500/30",
 "Senior Developer": "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
 "Junior Developer": "bg-amber-500/15 text-amber-300 border-amber-500/30",
 "Tester / QA": "bg-slate-500/15 text-slate-300 border-slate-500/30",
 "Scrum Master": "bg-teal-500/15 text-teal-300 border-teal-500/30",
 PM: "bg-teal-500/15 text-teal-300 border-teal-500/30",
 Dev: "bg-emerald-500/15 text-emerald-300 border-emerald-500/30",
 QA: "bg-slate-500/15 text-slate-300 border-slate-500/30",
 "AI Agent": "bg-indigo-500/15 text-indigo-300 border-indigo-500/30",
};

const STATUS_CONFIG: Record<string, { color: string; dot: string }> = {
 Active: { color: "text-emerald-400", dot: "bg-emerald-400" },
 "On Leave": { color: "text-amber-400", dot: "bg-amber-400" },
 Inactive: { color: "text-red-400", dot: "bg-red-400" },
};

// --- Main Page -----------------------------------------------------

const Employees: React.FC = () => {
 const router = useRouter();
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
 employees: "/employees",
 models: "/models",
 cost: "/cost",
 reports: "/reports",
 };
 router.push(navHref[item] || "/");
 };

 const [members, setMembers] = useState<Member[]>([]);
 const [teams, setTeams] = useState<Team[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState("");
 const [teamFilter, setTeamFilter] = useState("All Teams");
 const [roleFilter, setRoleFilter] = useState("All Roles");
 const [selectedId, setSelectedId] = useState<string>("");
 const [currentPage, setCurrentPage] = useState(1);
 const [rowsPerPage, setRowsPerPage] = useState(14);
 const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
 const [profileTab, setProfileTab] = useState("Overview");
 const [deleteTarget, setDeleteTarget] = useState<string | null>(null);
 const [deleting, setDeleting] = useState(false);
 const [formOpen, setFormOpen] = useState(false);
 const [editingMember, setEditingMember] = useState<Member | null>(null);
 const [saving, setSaving] = useState(false);
 const [formName, setFormName] = useState("");
 const [formRole, setFormRole] = useState("");
 const [formType, setFormType] = useState<"human" | "ai">("ai");
 const [formTeam, setFormTeam] = useState("");
 const [formError, setFormError] = useState("");
 const [roleGroups, setRoleGroups] = useState<{ id: string; name: string }[]>([]);

 const teamMap = teams.reduce<Record<string, string>>((acc, t) => {
 acc[t.id] = t.name;
 return acc;
 }, {});

 const teamName = (teamId: string) => teamMap[teamId] || teamId;

 const rolesList = Array.from(
 new Set(members.map((m) => m.role).filter(Boolean))
 ).sort();

 const teamsList = Array.from(
 new Set([
 ...teams.map((t) => t.name),
 ...members.map((m) => teamName(m.teamId)).filter(Boolean),
 ])
 ).sort();

 useEffect(() => {
 let cancelled = false;
 const load = async () => {
 try {
 setLoading(true);
 setError(null);
 const [data, groups] = await Promise.all([
 api.getTeams() as Promise<{ teams: Team[] }>,
 api.getRoleGroups().catch(() => []),
 ]);
 if (cancelled) return;
 const teamsData = Array.isArray(data) ? data : data.teams || [];
 setTeams(teamsData);
 const allMembers = teamsData.flatMap((t) => t.members || []);
 setMembers(allMembers);
 const groupsArr = Array.isArray(groups) ? groups : (groups?.data || []);
 setRoleGroups(groupsArr.map((g: any) => ({ id: g.id, name: g.name })));
 if (allMembers.length > 0) {
 setSelectedId(current => current || allMembers[0].id);
 }
 } catch (err) {
 if (!cancelled) {
 setError(err instanceof Error ? err.message : "Failed to load employees");
 }
 } finally {
 if (!cancelled) {
 setLoading(false);
 }
 }
 };
 load();
 return () => {
 cancelled = true;
 };
 }, []);

 const selectedMember = members.find((m) => m.id === selectedId);

 // Filtering
 const filtered = members.filter((member) => {
 const displayTeam = teamName(member.teamId);
 const matchesSearch =
 !searchQuery ||
 member.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 member.role.toLowerCase().includes(searchQuery.toLowerCase()) ||
 displayTeam.toLowerCase().includes(searchQuery.toLowerCase());
 const matchesTeam = teamFilter === "All Teams" || displayTeam === teamFilter;
 const matchesRole = roleFilter === "All Roles" || member.role === roleFilter;
 return matchesSearch && matchesTeam && matchesRole;
 });

 const totalPages = Math.max(1, Math.ceil(filtered.length / rowsPerPage));
 const safePage = Math.min(currentPage, totalPages);
 const pageStart = (safePage - 1) * rowsPerPage;
 const pageMembers = filtered.slice(pageStart, pageStart + rowsPerPage);

 const toggleSelect = (id: string) => {
 setSelectedIds((prev) => {
 const next = new Set(prev);
 if (next.has(id)) next.delete(id);
 else next.add(id);
 return next;
 });
 };

 const allOnPageSelected =
 pageMembers.length > 0 && pageMembers.every((m) => selectedIds.has(m.id));

 // Stats
 const totalEmployees = members.length;
 const activeCount = members.filter((m) => m.type === "human" || m.type === "ai").length;
 const onLeaveCount = 0;
 const inactiveCount = 0;
 const differentModels = new Set(
 members
 .filter((m) => m.type === "ai")
 .map((m) => m.role)
 ).size;

 // Loading / Error states
 if (loading) {
 return (
 <Layout activeNav="employees" onNavigate={handleNavigate}>
 <div className="px-6 py-20 flex items-center justify-center">
 <div className="flex flex-col items-center gap-3">
 <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
 <p className="text-sm text-slate-400">Loading employees...</p>
 </div>
 </div>
 </Layout>
 );
 }

 if (error) {
 return (
 <Layout activeNav="employees" onNavigate={handleNavigate}>
 <div className="px-6 py-20 flex items-center justify-center">
 <div className="flex flex-col items-center gap-3">
 <p className="text-sm text-red-400">Error: {error}</p>
 <button
 onClick={() => window.location.reload()}
 className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 transition-colors"
 >
 Retry
 </button>
 </div>
 </div>
 </Layout>
 );
 }

 // Render
 return (
 <Layout activeNav="employees" onNavigate={handleNavigate}>
 <div className="px-6">
 {/* Page Header */}
 <div>
 <div>
 <h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Employees</h1>
 <p className="text-sm text-slate-400">
 Manage your AI workforce, assign roles, configure models, and track performance across all teams.
 </p>
 </div>
 <div className="flex items-center gap-2 flex-nowrap mb-4">
 <div className="relative h-8">
 <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
 placeholder="Search employees..."
 className="input-field pl-8 w-36 text-xs h-full"
 />
 </div>
 <select
 value={teamFilter}
 onChange={(e) => { setTeamFilter(e.target.value); setCurrentPage(1); }}
 className="input-field text-xs py-1.5 pl-2 pr-7 h-8"
 >
 <option>All Teams</option>
 {teamsList.map((t) => (
 <option key={t}>{t}</option>
 ))}
 </select>
 <select
 value={roleFilter}
 onChange={(e) => { setRoleFilter(e.target.value); setCurrentPage(1); }}
 className="input-field text-xs py-1.5 pl-2 pr-7 h-8"
 >
 <option>All Roles</option>
 {rolesList.map((r) => (
 <option key={r}>{r}</option>
 ))}
 </select>
 <button
 onClick={async () => {
 setEditingMember(null);
 setFormName("");
 setFormRole("");
 setFormType("ai");
 setFormTeam(teamsList.length > 0 ? teamsList[0] : "");
 setFormError("");
 try {
 const groups = await api.getRoleGroups() as unknown;
 const data = Array.isArray(groups) ? groups : ((groups as { data?: unknown[] })?.data || []);
 setRoleGroups(data.map((g: any) => ({ id: g.id, name: g.name })));
 } catch { setRoleGroups([]); }
 setFormOpen(true);
 }}
 className="btn-primary flex items-center gap-1 text-xs px-2.5 py-1.5 h-8 flex-shrink-0"
>
 <FaPlus className="w-3 h-3" />
 Add Employee
</button>
 </div>
 </div>

 {/* Stats Row */}
 <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
 {[
 { label: "Total Employees", value: totalEmployees.toString(), sub: "^ 4 vs last month", accent: false },
 { label: "Active", value: activeCount.toString(), sub: `(${Math.round((activeCount / totalEmployees) * 100)}%)`, accent: false },
 { label: "On Leave", value: onLeaveCount.toString(), sub: `(${Math.round((onLeaveCount / totalEmployees) * 100)}%)`, accent: false },
 { label: "Inactive", value: inactiveCount.toString(), sub: `(${Math.round((inactiveCount / totalEmployees) * 100)}%)`, accent: false },
 { label: "Different Models", value: differentModels.toString(), sub: "Manage Models", accent: true },
 ].map((stat) => (
 <div key={stat.label} className="stat-card">
 <p className="text-xs text-slate-400 mb-1">{stat.label}</p>
 <p className="text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
 <p className={`text-xs mt-1 ${stat.accent ? "text-blue-400 hover:underline cursor-pointer" : "text-slate-500"}`}>
 {stat.sub}
 </p>
 </div>
 ))}
 </div>

 {/* Main Layout: Table + Profile Panel */}
 <div className="px-6">
 <div className="flex flex-col lg:flex-row gap-6 mb-6">
 {/* LEFT: Employee Table */}
 <div className="flex-1 min-w-0">
 <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
 <div className="overflow-x-auto">
 <table className="w-full text-sm">
 <thead>
 <tr className="border-b border-[var(--border-default)] text-left text-xs text-slate-400 uppercase tracking-wider">
 <th className="p-3 w-10">
 <button
 onClick={() => {
 if (allOnPageSelected) setSelectedIds(new Set());
 else setSelectedIds(new Set(pageMembers.map((m) => m.id)));
 }}
 className="text-slate-400 hover:text-[var(--text-primary)]"
 >
 <FaCheckSquare className={`w-4 h-4 ${allOnPageSelected ? "text-blue-400" : ""}`} />
 </button>
 </th>
 <th className="p-3">Name</th>
 <th className="p-3">Role</th>
 <th className="p-3">Team</th>
 <th className="p-3">Type</th>
 <th className="p-3">Status</th>
 <th className="p-3 text-right">Token Usage (7d)</th>
 <th className="p-3 w-10"></th>
 </tr>
 </thead>
 <tbody>
 {pageMembers.map((member) => {
 const isSelected = selectedId === member.id;
 const roleColor = ROLE_COLORS[member.role] || "bg-slate-500/15 text-slate-300 border-slate-500/30";
 const statusCfg = STATUS_CONFIG.Active;

 return (
 <tr
 key={member.id}
 onClick={() => setSelectedId(member.id)}
 className={`border-b border-[var(--border-default)]/50 cursor-pointer transition-colors ${
 isSelected ? "bg-blue-500/10" : "hover:bg-[var(--bg-secondary)]/40"
 }`}
 >
 <td className="p-3">
 <button
 onClick={(e) => { e.stopPropagation(); toggleSelect(member.id); }}
 className="text-slate-400 hover:text-[var(--text-primary)]"
 >
 <FaCheckSquare className={`w-4 h-4 ${selectedIds.has(member.id) ? "text-blue-400" : ""}`} />
 </button>
 </td>
 <td className="p-3">
 <div className="flex items-center gap-2">
 <FaUserCircle className="w-8 h-8 text-slate-500 flex-shrink-0" />
 <div>
 <span className={`font-medium ${isSelected ? "text-blue-300" : "text-[var(--text-primary)]"}`}>{member.name}</span>
 <span className="text-xs text-slate-500 block">{member.id}</span>
 </div>
 </div>
 </td>
 <td className="p-3">
 <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium border ${roleColor}`}>
 {member.type === "human" ? "Team Lead" : member.role}
 </span>
 </td>
 <td className="p-3 text-slate-300">{teamName(member.teamId)}</td>
 <td className="p-3 text-slate-300">
 <span className="inline-flex items-center gap-1.5 text-xs">
 <FaCircle className={`w-2 h-2 ${member.type === "ai" ? "text-indigo-400" : "text-emerald-400"}`} />
 {member.type === "ai" ? "AI Agent" : "Human"}
 </span>
 </td>
 <td className="p-3">
 <span className={`inline-flex items-center gap-1.5 text-xs ${statusCfg.color}`}>
 <FaCircle className="w-2 h-2" />
 Active
 </span>
 </td>
 <td className="p-3 text-right text-slate-300 font-mono text-xs">N/A</td>
 <td className="p-3">
 <div className="flex items-center justify-end gap-1">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setEditingMember(member);
 setFormName(member.name);
 setFormRole(member.type === "human" ? "Team Lead" : member.role);
 setFormType(member.type);
 setFormTeam(teamName(member.teamId));
 setFormError("");
 setFormOpen(true);
 }}
 className="text-slate-400 hover:text-blue-400 p-1"
 title="Edit employee"
 >
 <FaEdit className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={(e) => {
 e.stopPropagation();
 setDeleteTarget(member.id);
 }}
 className="text-slate-400 hover:text-red-400 p-1"
 title="Delete employee"
 >
 <FaTrash className="w-3.5 h-3.5" />
 </button>
 </div>
</td>
 </tr>
 );
 })}
 </tbody>
 </table>
 </div>
 </div>

 {/* Pagination */}
 <div className="flex items-center justify-between mt-4">
 <p className="text-xs text-slate-400">
 Showing {pageStart + 1}-{Math.min(pageStart + rowsPerPage, filtered.length)} of {filtered.length} employees
 </p>
 <div className="flex items-center gap-3">
 <div className="flex items-center gap-1">
 <span className="text-xs text-slate-400 mr-1">Page</span>
 {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
 <button
 key={page}
 onClick={() => setCurrentPage(page)}
 className={`w-8 h-8 rounded text-xs flex items-center justify-center transition-colors ${
 safePage === page ? "bg-blue-600 text-white" : "text-slate-400 hover:bg-[var(--bg-secondary)]"
 }`}
 >
 {page}
 </button>
 ))}
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs text-slate-400">Rows per page:</span>
 <select
 value={rowsPerPage}
 onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }}
 className="input-field text-xs py-1"
 >
 <option value={7}>7</option>
 <option value={14}>14</option>
 <option value={28}>28</option>
 </select>
 </div>
 </div>
 </div>
 </div>

 {/* RIGHT: Profile Panel */}
 {selectedMember ? (
 <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
 <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
 {/* Header */}
 <div className="p-5 text-center border-b border-[var(--border-default)]">
 <div className="w-16 h-16 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center mx-auto mb-3">
 <span className="text-2xl font-bold text-[var(--text-primary)]">
 {selectedMember.name.split(" ").map((n) => n[0]).join("")}
 </span>
 </div>
 <div className="flex items-center justify-center gap-2">
 <h3 className="text-lg font-semibold text-[var(--text-primary)]">{selectedMember.name}</h3>
 <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
 <FaCircle className="w-1.5 h-1.5" />
 Active
 </span>
 </div>
 <p className="text-sm text-slate-400 mt-1">
 {selectedMember.type === "human" ? "Team Lead" : selectedMember.role} - {teamName(selectedMember.teamId)}
 </p>
 <p className="text-xs text-slate-500 mt-2 italic">&ldquo;{selectedMember.type === "human" ? "Team Lead" : selectedMember.role} that inspire.&rdquo;</p>
 </div>

 {/* Tabs */}
 <div className="flex border-b border-[var(--border-default)]">
 {["Overview", "Work", "Performance", "Settings"].map((tab) => (
 <button
 key={tab}
 onClick={() => setProfileTab(tab)}
 className={`flex-1 py-2.5 text-xs font-medium transition-colors ${
 profileTab === tab
 ? "text-blue-400 border-b-2 border-blue-400"
 : "text-slate-400 hover:text-slate-300"
 }`}
 >
 {tab}
 </button>
 ))}
 </div>

 {/* Overview Content */}
 {profileTab === "Overview" && (
 <div className="p-5 space-y-4">
 {[
 { label: "Member ID", value: selectedMember.id },
 { label: "Team", value: teamName(selectedMember.teamId) },
 { label: "Role", value: selectedMember.type === "human" ? "Team Lead" : selectedMember.role },
 { label: "Type", value: selectedMember.type === "ai" ? "AI Agent" : "Human" },
 { label: "Status", value: "Active" },
 ].map((field) => (
 <div key={field.label} className="flex justify-between items-start">
 <span className="text-xs text-slate-400">{field.label}</span>
 <span className="text-xs text-[var(--text-primary)] text-right">{field.value}</span>
 </div>
 ))}

 {/* Model Configuration */}
 <div>
 <p className="text-xs text-slate-400 mb-2">Model Configuration</p>
 <div className="bg-[var(--bg-secondary)]/50 rounded p-3 border border-[var(--border-default)]/50">
 <div className="flex items-center justify-between mb-1">
 <span className="text-xs text-[var(--text-primary)] font-medium">
 {selectedMember.type === "ai" ? "AI Agent" : "N/A"}
 </span>
 <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-300 border border-amber-500/30 font-medium">
 {selectedMember.type === "ai" ? "AI Powered" : "Human"}
 </span>
 </div>
 <p className="text-[10px] text-slate-500">
 {selectedMember.type === "ai"
 ? "Autonomous AI agent"
 : "Manual human contributor"}
 </p>
 </div>
 </div>

 {/* Workload */}
 <div>
 <div className="flex justify-between items-center mb-1">
 <p className="text-xs text-slate-400">Workload</p>
 <span className="text-xs text-[var(--text-primary)] font-medium">70%</span>
 </div>
 <div className="h-2 rounded-full bg-[var(--bg-tertiary)] overflow-hidden">
 <div className="h-full rounded-full bg-blue-500" style={{ width: "70%" }} />
 </div>
 </div>
 </div>
 )}

 {/* Work Tab */}
 {profileTab === "Work" && (
 <div className="p-5">
 <p className="text-xs text-slate-500">Recent work activity for {selectedMember.name}.</p>
 <div className="mt-3 space-y-2">
 <div className="bg-[var(--bg-secondary)]/50 rounded p-3 border border-[var(--border-default)]/50">
 <p className="text-xs text-[var(--text-primary)]">{selectedMember.type === "human" ? "Team Lead" : selectedMember.role} assignments</p>
 <p className="text-[10px] text-slate-500 mt-0.5">{teamName(selectedMember.teamId)}</p>
 <span className="inline-block mt-1 text-[10px] text-blue-400">
 Active
 </span>
 </div>
 </div>
 </div>
 )}

 {/* Performance Tab */}
 {profileTab === "Performance" && (
 <div className="p-5 space-y-3">
 <div className="flex justify-between">
 <span className="text-xs text-slate-400">Tasks Completed</span>
 <span className="text-xs text-[var(--text-primary)]">42</span>
 </div>
 <div className="flex justify-between">
 <span className="text-xs text-slate-400">Avg. Completion Time</span>
 <span className="text-xs text-[var(--text-primary)]">2.3 days</span>
 </div>
 <div className="flex justify-between">
 <span className="text-xs text-slate-400">Quality Score</span>
 <span className="text-xs text-emerald-400">94%</span>
 </div>
 <div className="flex justify-between">
 <span className="text-xs text-slate-400">Token Efficiency</span>
 <span className="text-xs text-[var(--text-primary)]">Good</span>
 </div>
 <div className="flex justify-between">
 <span className="text-xs text-slate-400">Uptime</span>
 <span className="text-xs text-emerald-400">99.2%</span>
 </div>
 </div>
 )}

 {/* Settings Tab */}
 {profileTab === "Settings" && (
 <div className="p-5 space-y-3">
 <div className="flex justify-between items-center">
 <span className="text-xs text-slate-400">Auto-assign tasks</span>
 <FaCheckCircle className="w-4 h-4 text-emerald-400" />
 </div>
 <div className="flex justify-between items-center">
 <span className="text-xs text-slate-400">Notify on assignment</span>
 <FaCheckCircle className="w-4 h-4 text-emerald-400" />
 </div>
 <div className="flex justify-between items-center">
 <span className="text-xs text-slate-400">Allow model override</span>
 <FaTimesCircle className="w-4 h-4 text-red-400" />
 </div>
 <div className="flex justify-between items-center">
 <span className="text-xs text-slate-400">Pause when inactive</span>
 <FaCheckCircle className="w-4 h-4 text-emerald-400" />
 </div>
 </div>
 )}
 </div>
 </div>
 ) : (
 <div className="w-full lg:w-80 xl:w-96 flex-shrink-0">
 <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden flex items-center justify-center py-20">
 <p className="text-sm text-slate-500">Select an employee to view details</p>
 </div>
 </div>
 )}
 </div>

 {/* Bottom Charts Row */}
 <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
 {/* 1. Employees by Role */}
 <div className="stat-card">
 <div className="flex items-center gap-2 mb-3">
 <FaUsers className="w-4 h-4 text-blue-400" />
 <h3 className="text-sm font-medium text-[var(--text-primary)]">Employees by Role</h3>
 </div>
 <div className="flex items-center gap-4">
 <InteractiveDonut
 segments={[
 { label: "Senior Developer", value: 8, color: "#10b981" },
 { label: "Scrum Master", value: 4, color: "#6366f1" },
 { label: "Designer", value: 4, color: "#a855f7" },
 { label: "Junior Developer", value: 4, color: "#f59e0b" },
 { label: "Tester/QA", value: 4, color: "#94a3b8" },
 { label: "Business Analyst", value: 4, color: "#14b8a6" },
 ]}
 centerLabel="By Role"
 showLegend={true}
 />
 <div className="space-y-1.5 flex-1">
 {[
 { label: "Senior Developer", count: 8, color: "bg-emerald-400" },
 { label: "Scrum Master", count: 4, color: "bg-teal-400" },
 { label: "Designer", count: 4, color: "bg-purple-400" },
 { label: "Junior Developer", count: 4, color: "bg-amber-400" },
 { label: "Tester/QA", count: 4, color: "bg-slate-400" },
 { label: "Business Analyst", count: 4, color: "bg-blue-400" },
 ].map((item) => (
 <div key={item.label} className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <div className={`w-2 h-2 rounded-sm ${item.color}`} />
 <span className="text-[11px] text-slate-400">{item.label}</span>
 </div>
 <span className="text-[11px] text-slate-300">{item.count}</span>
 </div>
 ))}
 </div>
 </div>
 <p className="text-[10px] text-slate-500 mt-2">{totalEmployees} total</p>
 </div>

 {/* 2. Employees by Team */}
 <div className="stat-card">
 <div className="flex items-center gap-2 mb-3">
 <FaUsers className="w-4 h-4 text-teal-400" />
 <h3 className="text-sm font-medium text-[var(--text-primary)]">Employees by Team</h3>
 </div>
 <div className="flex items-center gap-4">
 <InteractiveDonut
 segments={[
 { label: "Team Alpha", value: 7, color: "#3b82f6" },
 { label: "Team Beta", value: 7, color: "#6366f1" },
 { label: "Team Gamma", value: 7, color: "#a855f7" },
 { label: "Team Delta", value: 7, color: "#10b981" },
 ]}
 centerLabel="By Team"
 showLegend={true}
 />
 <div className="space-y-1.5 flex-1">
 {[
 { label: "Team Alpha", count: 7, color: "bg-blue-400" },
 { label: "Team Beta", count: 7, color: "bg-indigo-400" },
 { label: "Team Gamma", count: 7, color: "bg-purple-400" },
 { label: "Team Delta", count: 7, color: "bg-emerald-400" },
 ].map((item) => (
 <div key={item.label} className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <div className={`w-2 h-2 rounded-sm ${item.color}`} />
 <span className="text-[11px] text-slate-400">{item.label}</span>
 </div>
 <span className="text-[11px] text-slate-300">{item.count}</span>
 </div>
 ))}
 </div>
 </div>
 <p className="text-[10px] text-slate-500 mt-2">{totalEmployees} total</p>
 </div>

 {/* 3. Model Usage */}
 <div className="stat-card">
 <div className="flex items-center gap-2 mb-3">
 <FaMicrochip className="w-4 h-4 text-purple-400" />
 <h3 className="text-sm font-medium text-[var(--text-primary)]">Model Usage</h3>
 </div>
 <div className="flex items-center gap-4">
 <InteractiveDonut
 segments={[
 { label: "Sonnet 4", value: 12, color: "#6366f1" },
 { label: "Opus 5", value: 6, color: "#8b5cf6" },
 { label: "Haiku", value: 4, color: "#f59e0b" },
 { label: "Fable 5.1", value: 2, color: "#a855f7" },
 { label: "Other", value: 4, color: "#64748b" },
 ]}
 centerLabel="Models"
 showLegend={true}
 />
 <div className="space-y-1.5 flex-1">
 {[
 { label: "Sonnet 4", count: 12, color: "bg-indigo-400" },
 { label: "Opus 5", count: 6, color: "bg-violet-400" },
 { label: "Haiku", count: 4, color: "bg-amber-400" },
 { label: "Fable 5.1", count: 2, color: "bg-fuchsia-400" },
 { label: "Other", count: 4, color: "bg-slate-400" },
 ].map((item) => (
 <div key={item.label} className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <div className={`w-2 h-2 rounded-sm ${item.color}`} />
 <span className="text-[11px] text-slate-400">{item.label}</span>
 </div>
 <span className="text-[11px] text-slate-300">{item.count}</span>
 </div>
 ))}
 </div>
 </div>
 <p className="text-[10px] text-slate-500 mt-2">{totalEmployees} total</p>
 </div>

 {/* 4. Availability */}
 <div className="stat-card">
 <div className="flex items-center gap-2 mb-3">
 <FaTasks className="w-4 h-4 text-emerald-400" />
 <h3 className="text-sm font-medium text-[var(--text-primary)]">Availability</h3>
 </div>
 <div className="flex items-center gap-4">
 <InteractiveDonut
 segments={[
 { label: "Active", value: 24, color: "#10b981" },
 { label: "On Leave", value: 3, color: "#f59e0b" },
 { label: "Inactive", value: 1, color: "#ef4444" },
 ]}
 centerLabel="Staff"
 showLegend={true}
 />
 <div className="space-y-1.5 flex-1">
 {[
 { label: "Active", count: 24, pct: "86%", color: "text-emerald-400", bar: "bg-emerald-400" },
 { label: "On Leave", count: 3, pct: "11%", color: "text-amber-400", bar: "bg-amber-400" },
 { label: "Inactive", count: 1, pct: "3%", color: "text-red-400", bar: "bg-red-400" },
 ].map((item) => (
 <div key={item.label}>
 <div className="flex items-center justify-between">
 <div className="flex items-center gap-1.5">
 <div className={`w-2 h-2 rounded-sm ${item.bar}`} />
 <span className="text-[11px] text-slate-400">{item.label}</span>
 </div>
 <span className={`text-[11px] ${item.color} font-medium`}>{item.pct}</span>
 </div>
 </div>
 ))}
 </div>
 </div>
 </div>
 <p className="text-[10px] text-slate-500 mt-2">{totalEmployees} total</p>
 </div>
 </div>
 </div>

 {/* Add/Edit Employee Dialog */}
{formOpen && (
 <div
 className="fixed inset-0 flex items-center justify-center p-4"
 style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 50, backdropFilter: 'blur(4px)' }}
 >
 <form
 onSubmit={async (e) => {
 e.preventDefault();
 setSaving(true);
 setFormError("");
 try {
 const teamId = teams.find((t) => t.name === formTeam)?.id || formTeam;
 if (editingMember) {
 const data: any = { name: formName, type: formType, teamId };
 if (formType === "human") data.role = "Team Lead";
 else data.role = formRole;
 const updated = await api.updateMember(editingMember.id, data);
 setMembers((prev) => prev.map((m) => m.id === editingMember.id ? { ...m, ...updated } : m));
 if (selectedId === editingMember.id) setSelectedId(editingMember.id);
 } else {
 const data: any = { name: formName, role: formType === "human" ? "Team Lead" : formRole, type: formType, teamId };
 const created = await api.createMember(data);
 setMembers((prev) => [...prev, created]);
 }
 setFormOpen(false);
 } catch (err) {
 setFormError(err instanceof Error ? err.message : 'Failed to save employee');
 } finally {
 setSaving(false);
 }
 }}
 className="page-panel w-full max-w-sm space-y-4"
 >
 <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
 {editingMember ? 'Edit Employee' : 'Add Employee'}
 </h2>
 {formError && <p role="alert" style={{ color: 'var(--error)' }}>{formError}</p>}
 <label className="block">
 <span className="text-xs text-slate-400">Name</span>
 <input
 value={formName}
 onChange={(e) => setFormName(e.target.value)}
 required
 className="input-field mt-1"
 />
 </label>
 <label className="block">
 <span className="text-xs text-slate-400">Type</span>
 <select
 value={formType}
 onChange={(e) => {
 const t = e.target.value as "human" | "ai";
 setFormType(t);
 if (t === "human") setFormRole("Team Lead");
 }}
 className="input-field mt-1"
 >
 <option value="ai">AI Agent</option>
 <option value="human">Human</option>
 </select>
 </label>
 <label className="block">
 <span className="text-xs text-slate-400">Role</span>
 {formType === "human" ? (
 <input value="Team Lead" disabled className="input-field mt-1 opacity-60" />
 ) : (
 <select
 value={formRole}
 onChange={(e) => setFormRole(e.target.value)}
 required
 className="input-field mt-1"
 >
 <option value="">Select a role...</option>
 {roleGroups.map((rg) => (
 <option key={rg.id} value={rg.name}>{rg.name}</option>
 ))}
 </select>
 )}
 {formType === "human" && (
 <p className="text-[10px] text-slate-500 mt-0.5">Human employees are always assigned the Team Lead role.</p>
 )}
 </label>
 <label className="block">
 <span className="text-xs text-slate-400">Team</span>
 <select
 value={formTeam}
 onChange={(e) => setFormTeam(e.target.value)}
 required
 className="input-field mt-1"
 >
 {teamsList.map((t) => (
 <option key={t} value={t}>{t}</option>
 ))}
 </select>
 </label>
 <div className="flex items-center gap-3 pt-2">
 <button type="submit" disabled={saving} className="btn-primary">
 {saving ? 'Saving...' : editingMember ? 'Save Changes' : 'Add Employee'}
 </button>
 <button type="button" onClick={() => setFormOpen(false)} disabled={saving} className="btn-secondary">
 Cancel
 </button>
 </div>
 </form>
 </div>
)}

 {/* Delete Confirmation Dialog */}
 {deleteTarget && (
 <div
 className="fixed inset-0 flex items-center justify-center p-4"
 style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 50, backdropFilter: 'blur(4px)' }}
 >
 <div className="page-panel w-full max-w-sm space-y-4">
 <h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>
 Delete Employee
 </h2>
 <p className="text-sm text-slate-400">
 Are you sure you want to delete this employee? This action cannot be undone.
 </p>
 <div className="flex items-center gap-3 pt-2">
 <button
 onClick={async () => {
 setDeleting(true);
 try {
 await api.deleteMember(deleteTarget);
 setMembers((prev) => prev.filter((m) => m.id !== deleteTarget));
 if (selectedId === deleteTarget) setSelectedId('');
 setSelectedIds((prev) => { const s = new Set(prev); s.delete(deleteTarget); return s; });
 } catch (err) {
 alert(err instanceof Error ? err.message : 'Failed to delete employee');
 } finally {
 setDeleting(false);
 setDeleteTarget(null);
 }
 }}
 disabled={deleting}
 className="btn-primary"
 style={{ backgroundColor: '#dc2626' }}
 >
 {deleting ? 'Deleting...' : 'Delete'}
 </button>
 <button
 onClick={() => setDeleteTarget(null)}
 disabled={deleting}
 className="btn-secondary"
 >
 Cancel
 </button>
 </div>
 </div>
 </div>
 )}
 </Layout>
 );
};

export default Employees;

