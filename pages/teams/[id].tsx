import api from "@/lib/api-client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import type { TaskWithCI, Activity, Member, Agent, RoleGroup } from "@/types";
import Layout from "@/components/Layout";
import ActivityFeed from "@/components/ActivityFeed";
import {
 FaArrowLeft,
 FaUsers,
 FaMicrochip,
 FaCodeBranch,
 FaPlus,
 FaPlay,
 FaArrowRight,
 FaCheck,
 FaUserMinus,
 FaUserPlus,
} from "react-icons/fa";

const statusBadge = (s: string) => {
 if (s === "done") return "bg-green-400/10 text-green-400";
 if (s === "in_progress") return "bg-blue-400/10 text-blue-400";
 if (s === "review" || s === "testing") return "bg-amber-400/10 text-amber-300";
 if (s === "blocked") return "bg-red-400/10 text-red-300";
 if (s === "ready") return "bg-cyan-400/10 text-cyan-300";
 return "bg-slate-800 text-slate-400";
};

const TeamProgress: React.FC = () => {
 const router = useRouter();
 const [tasks, setTasks] = useState<TaskWithCI[]>([]);
 const [members, setMembers] = useState<Member[]>([]);
 const [agents, setAgents] = useState<Agent[]>([]);
 const [benchAgents, setBenchAgents] = useState<Agent[]>([]);
 const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
 const [activities, setActivities] = useState<Activity[]>([]);
 const [team, setTeam] = useState<{name: string; description?: string; status: string} | null>(null);
 const [error, setError] = useState("");
 const [actionError, setActionError] = useState("");
 const [actionMessage, setActionMessage] = useState("");
 const [benchingAgentId, setBenchingAgentId] = useState<string | null>(null);
 const [assigningBenchAgentId, setAssigningBenchAgentId] = useState<string | null>(null);
 const [isCreatingTask, setIsCreatingTask] = useState(false);
 const [taskForm, setTaskForm] = useState({
  title: "",
  description: "",
  priority: "medium",
  agentId: "",
  startNow: false,
 });

 useEffect(() => {
 if (typeof router.query.id !== 'string') return;
 let active = true;
 const id = router.query.id;
  Promise.all([api.getTeam(id), api.getActivities(id), api.getAgents(id), api.getAgents("on-bench"), api.getRoleGroups()])
   .then(([teamData, activityData, agentData, benchAgentData, roleGroupData]) => {
    if (!active) return;
    setTeam(teamData);
    setTasks(teamData.tasks || []);
    setMembers(teamData.members || []);
    setActivities(activityData || []);
    setAgents(agentData || []);
    setBenchAgents(benchAgentData || []);
    setRoleGroups(roleGroupData || []);
   })
   .catch(e => active && setError(e.message));
  return () => { active = false; };
 }, [router.query.id]);

 const handleNavigate = (_navId: string) => {
 router.push("/");
 };

 const handleCreateTask = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (typeof router.query.id !== "string") return;
  const title = taskForm.title.trim();
  if (!title) {
   setActionError("Task title is required.");
   return;
  }
  setIsCreatingTask(true);
  setActionError("");
  try {
   const created = await api.createTask({
    title,
    description: taskForm.description.trim() || undefined,
    priority: taskForm.priority,
    status: taskForm.startNow ? "in_progress" : "backlog",
    teamId: router.query.id,
    agentId: taskForm.agentId || undefined,
   });
   setTasks((current) => [created, ...current]);
   setTaskForm({ title: "", description: "", priority: "medium", agentId: "", startNow: false });
   const activityData = await api.getActivities(router.query.id);
   setActivities(activityData || []);
  } catch (e) {
   setActionError((e as Error).message);
  } finally {
   setIsCreatingTask(false);
  }
 };

 const handleMoveTask = async (task: TaskWithCI, status: string) => {
  setActionError("");
  setActionMessage("");
  try {
   const updated = await api.updateTaskStatus(task.id, status);
   setTasks((current) => current.map((item) => item.id === task.id ? updated : item));
   if (typeof router.query.id === "string") {
    const activityData = await api.getActivities(router.query.id);
    setActivities(activityData || []);
   }
  } catch (e) {
   setActionError((e as Error).message);
  }
 };

 const handleBenchAgent = async (agent: Agent) => {
  if (typeof router.query.id !== "string") return;
  if (agent.status === "working") {
   setActionError("Stop the agent before moving it to the bench.");
   setActionMessage("");
   return;
  }
  const confirmed = window.confirm(`Remove ${agent.name} from this team and move it to On Bench?`);
  if (!confirmed) return;
  setBenchingAgentId(agent.id);
  setActionError("");
  setActionMessage("");
  try {
   await api.benchAgent(agent.id);
   const id = router.query.id;
   const [teamData, activityData, agentData] = await Promise.all([
    api.getTeam(id),
    api.getActivities(id),
    api.getAgents(id),
   ]);
   setTeam(teamData);
   setTasks(teamData.tasks || []);
   setMembers(teamData.members || []);
   setActivities(activityData || []);
   setAgents(agentData || []);
   const nextBenchAgents = await api.getAgents("on-bench");
   setBenchAgents(nextBenchAgents || []);
   setActionMessage(`${agent.name} moved to On Bench.`);
  } catch (e) {
   setActionError((e as Error).message);
  } finally {
   setBenchingAgentId(null);
  }
 };

 const handleAddBenchAgent = async (agent: Agent) => {
  if (typeof router.query.id !== "string" || isBenchTeam) return;
  const teamId = router.query.id;
  setAssigningBenchAgentId(agent.id);
  setActionError("");
  setActionMessage("");
  try {
   await api.updateAgent(agent.id, { teamId });
   const [teamData, activityData, agentData, benchAgentData] = await Promise.all([
    api.getTeam(teamId),
    api.getActivities(teamId),
    api.getAgents(teamId),
    api.getAgents("on-bench"),
   ]);
   setTeam(teamData);
   setTasks(teamData.tasks || []);
   setMembers(teamData.members || []);
   setActivities(activityData || []);
   setAgents(agentData || []);
   setBenchAgents(benchAgentData || []);
   setActionMessage(`${agent.name} added to ${teamData.name || "this team"}.`);
  } catch (e) {
   setActionError((e as Error).message);
  } finally {
   setAssigningBenchAgentId(null);
  }
 };

 const backlogTasks = tasks.filter((t) => t.status === "backlog" || t.status === "ready");
 const inProgressTasks = tasks.filter((t) => ["in_progress", "review", "testing", "blocked"].includes(t.status));
 const doneTasks = tasks.filter((t) => t.status === "done");
 const activeAgents = agents.filter((agent) => agent.status === "working").length;
 const isBenchTeam = router.query.id === "on-bench";
 const roleGroupNameForAgent = (agent: Agent) =>
  roleGroups.find((group) => group.assignments.some((assignment) => assignment.agentId === agent.id))?.name || "No Role Group";
 const benchAgentsByRoleGroup = roleGroups
  .map((group) => ({
   id: group.id,
   name: group.name,
   agents: benchAgents.filter((agent) => group.assignments.some((assignment) => assignment.agentId === agent.id)),
  }))
  .filter((group) => group.agents.length > 0);
 const ungroupedBenchAgents = benchAgents.filter((agent) => roleGroupNameForAgent(agent) === "No Role Group");
 const benchGroups = [
  ...benchAgentsByRoleGroup,
  ...(ungroupedBenchAgents.length ? [{ id: "no-role-group", name: "No Role Group", agents: ungroupedBenchAgents }] : []),
 ];

 const nextStatusFor = (status: string) => {
  if (status === "in_progress") return { label: "Send to review", status: "review", icon: <FaArrowRight className="w-3 h-3" /> };
  if (status === "review") return { label: "Move to testing", status: "testing", icon: <FaArrowRight className="w-3 h-3" /> };
  if (status === "testing") return { label: "Mark done", status: "done", icon: <FaCheck className="w-3 h-3" /> };
  return null;
 };

 const renderTaskCard = (task: TaskWithCI) => {
  const next = nextStatusFor(task.status);
  return (
   <div key={task.id} className="text-sm text-slate-300 p-3 bg-slate-800 rounded border border-slate-700 mt-2 space-y-2">
    <div className="flex items-start justify-between gap-3">
     <div>
      <p className="font-medium text-white">{task.title}</p>
      {task.description && <p className="text-xs text-slate-400 mt-1 line-clamp-2">{task.description}</p>}
     </div>
     <span className={"shrink-0 text-xs px-1.5 py-0.5 rounded " + statusBadge(task.status)}>{task.status}</span>
    </div>
    <div className="flex items-center justify-between gap-2 text-xs text-slate-500">
     <span className="capitalize">{task.priority || "medium"} priority</span>
     {task.agent?.name && <span>{task.agent.name}</span>}
    </div>
    {next && (
     <button
      onClick={() => handleMoveTask(task, next.status)}
      className="inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 transition-colors"
     >
      {next.icon}
      {next.label}
     </button>
    )}
   </div>
  );
 };

 return (
 <Layout activeNav="teams" onNavigate={handleNavigate}>
 <button onClick={() => router.push("/teams")} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4 transition-colors">
 <FaArrowLeft className="w-4 h-4" />
 Back to Teams
 </button>

 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white">{team?.name || "Team"}</h1>
 <p className="text-sm text-slate-400 mt-1">{error || team?.description || ""}</p>
 </div>
 <div className="flex items-center gap-2">
 <span className="text-xs px-2 py-1 rounded-full bg-green-400/10 text-green-400">{team?.status}</span>
 <span className="text-xs px-2 py-1 rounded-full bg-slate-800 text-slate-400">{tasks.length} tasks</span>
 </div>
 </div>

 <div className="flex items-center gap-6">
 <div className="flex items-center gap-2">
 <FaUsers className="w-4 h-4 text-slate-400" />
 <span className="text-sm text-slate-400">{members.length} members</span>
 </div>
 <div className="flex items-center gap-2">
 <FaMicrochip className="w-4 h-4 text-slate-400" />
 <span className="text-sm text-slate-400">{members.filter(m => m.type === "ai").length} AI members</span>
 </div>
 <div className="flex items-center gap-2">
 <FaCodeBranch className="w-4 h-4 text-slate-400" />
 <span className="text-sm text-slate-400">{activeAgents} active agents</span>
 </div>
 </div>

 <div className="grid grid-cols-1 xl:grid-cols-[1.2fr_0.8fr] gap-4">
 <form onSubmit={handleCreateTask} className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4 space-y-4">
 <div className="flex items-center justify-between">
 <div>
 <h2 className="text-lg font-semibold text-white">Engineering Intake</h2>
 <p className="text-sm text-slate-400 mt-1">Create team work and optionally assign it to one of this team&apos;s agents.</p>
 </div>
 <FaPlus className="w-4 h-4 text-slate-500" />
 </div>
 {actionError && <div className="text-sm text-red-300 bg-red-400/10 border border-red-400/20 rounded px-3 py-2">{actionError}</div>}
 {actionMessage && <div className="text-sm text-emerald-300 bg-emerald-400/10 border border-emerald-400/20 rounded px-3 py-2">{actionMessage}</div>}
 <div>
 <label className="block text-xs text-slate-400 mb-1">Task Title</label>
 <input
 value={taskForm.title}
 onChange={(e) => setTaskForm((current) => ({ ...current, title: e.target.value }))}
 className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
 placeholder="Build API retry handling"
 />
 </div>
 <div>
 <label className="block text-xs text-slate-400 mb-1">Description</label>
 <textarea
 value={taskForm.description}
 onChange={(e) => setTaskForm((current) => ({ ...current, description: e.target.value }))}
 rows={3}
 className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
 placeholder="What should the engineer or agent know before starting?"
 />
 </div>
 <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
 <div>
 <label className="block text-xs text-slate-400 mb-1">Priority</label>
 <select
 value={taskForm.priority}
 onChange={(e) => setTaskForm((current) => ({ ...current, priority: e.target.value }))}
 className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
 >
 <option value="low">Low</option>
 <option value="medium">Medium</option>
 <option value="high">High</option>
 <option value="critical">Critical</option>
 </select>
 </div>
 <div>
 <label className="block text-xs text-slate-400 mb-1">Assign Agent</label>
 <select
 value={taskForm.agentId}
 onChange={(e) => setTaskForm((current) => ({ ...current, agentId: e.target.value }))}
 className="w-full bg-slate-900 border border-slate-700 rounded px-3 py-2 text-sm text-white focus:outline-none focus:border-blue-500"
 >
 <option value="">Unassigned</option>
 {agents.map((agent) => (
 <option key={agent.id} value={agent.id}>{agent.name}</option>
 ))}
 </select>
 </div>
 <label className="flex items-center gap-2 text-sm text-slate-300 bg-slate-900 border border-slate-700 rounded px-3 py-2 mt-5">
 <input
 type="checkbox"
 checked={taskForm.startNow}
 onChange={(e) => setTaskForm((current) => ({ ...current, startNow: e.target.checked }))}
 className="accent-blue-500"
 />
 Start now
 </label>
 </div>
 <button
 type="submit"
 disabled={isCreatingTask}
 className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed rounded text-sm font-medium text-white transition-colors"
 >
 <FaPlus className="w-3 h-3" />
 {isCreatingTask ? "Creating..." : "Add Task"}
 </button>
 </form>

 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-4">
 <div className="flex items-center justify-between mb-3">
 <div>
 <h2 className="text-lg font-semibold text-white">Agent Workload</h2>
 <p className="text-sm text-slate-400 mt-1">Team agents available for engineering assignments.</p>
 </div>
 <FaPlay className="w-4 h-4 text-slate-500" />
 </div>
 <div className="space-y-2">
 {agents.length === 0 && <div className="text-sm text-slate-500 border border-dashed border-slate-700 rounded p-3">No agents are assigned to this team yet.</div>}
 {agents.map((agent) => (
 <div key={agent.id} className="flex items-center justify-between gap-3 bg-slate-800/50 border border-slate-700 rounded p-3">
 <div className="min-w-0 flex-1">
 <p className="text-sm font-medium text-white truncate">{agent.name}</p>
 <p className="text-xs text-slate-400 truncate">{agent.model}</p>
 </div>
 <span className={"shrink-0 text-xs px-2 py-1 rounded-full " + (agent.status === "working" ? "bg-blue-400/10 text-blue-300" : agent.status === "error" ? "bg-red-400/10 text-red-300" : "bg-slate-900 text-slate-400")}>
 {agent.status}
 </span>
 {!isBenchTeam && (
 <button
 type="button"
 onClick={() => handleBenchAgent(agent)}
 disabled={benchingAgentId === agent.id || agent.status === "working"}
 title={agent.status === "working" ? "Stop the agent before moving it to the bench" : "Move to On Bench"}
 className="shrink-0 inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded border border-slate-600 text-slate-300 hover:text-white hover:border-slate-500 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
 >
 <FaUserMinus className="w-3 h-3" />
 {benchingAgentId === agent.id ? "Moving..." : "Remove"}
 </button>
 )}
 </div>
 ))}
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-slate-400">Backlog</span>
 <span className="text-lg font-semibold text-white">{backlogTasks.length}</span>
 </div>
 {backlogTasks.map(renderTaskCard)}
 </div>

 <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-slate-400">In Progress</span>
 <span className="text-lg font-semibold text-white">{inProgressTasks.length}</span>
 </div>
 {inProgressTasks.map(renderTaskCard)}
 </div>

 <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-slate-400">Done</span>
 <span className="text-lg font-semibold text-white">{doneTasks.length}</span>
 </div>
 {doneTasks.map(renderTaskCard)}
 </div>
 </div>

 {!isBenchTeam && (
 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg overflow-hidden">
 <div className="px-4 py-3 border-b border-slate-700">
 <h2 className="text-lg font-semibold text-white">On Bench Agents</h2>
 <p className="text-sm text-slate-400 mt-1">Add available bench agents to this team by role group.</p>
 </div>
 <div className="p-4 space-y-4">
 {benchGroups.length === 0 && (
 <div className="text-sm text-slate-500 border border-dashed border-slate-700 rounded p-4">No bench agents are available right now.</div>
 )}
 {benchGroups.map((group) => (
 <div key={group.id} className="space-y-2">
 <div className="flex items-center justify-between">
 <h3 className="text-sm font-semibold text-slate-200">{group.name}</h3>
 <span className="text-xs px-2 py-0.5 rounded-full bg-slate-800 text-slate-400">{group.agents.length} available</span>
 </div>
 <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
 {group.agents.map((agent) => (
 <div key={agent.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 flex items-center justify-between gap-3">
 <div className="min-w-0">
 <p className="text-sm font-medium text-white truncate">{agent.name}</p>
 <p className="text-xs text-slate-400 truncate">{agent.model}</p>
 </div>
 <button
 type="button"
 onClick={() => handleAddBenchAgent(agent)}
 disabled={assigningBenchAgentId === agent.id}
 className="shrink-0 inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded bg-blue-600 hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors"
 >
 <FaUserPlus className="w-3 h-3" />
 {assigningBenchAgentId === agent.id ? "Adding..." : "Add"}
 </button>
 </div>
 ))}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}

 <div>
 <h2 className="text-lg font-semibold text-white mb-3">Recent Activity</h2>
 <ActivityFeed activities={activities} maxHeight="400px" />
 </div>
 </div>
 </Layout>
 );
};

export default TeamProgress;
