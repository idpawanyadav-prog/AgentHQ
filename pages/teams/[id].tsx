import api from "@/lib/api-client";
import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import type { TaskWithCI, Activity, Member, Agent } from "@/types";
import Layout from "@/components/Layout";
import ActivityFeed from "@/components/ActivityFeed";
import { FaArrowLeft, FaUsers, FaMicrochip, FaCodeBranch, FaRobot, FaUser } from "react-icons/fa";

const statusBadge = (s: string) => {
 if (s === "done") return "bg-green-400/10 text-green-400";
 if (s === "in_progress") return "bg-blue-400/10 text-blue-400";
 return "bg-slate-800 text-slate-400";
};

const TeamProgress: React.FC = () => {
 const router = useRouter();
 const [tasks, setTasks] = useState<TaskWithCI[]>([]);
 const [members, setMembers] = useState<Member[]>([]);
 const [activities, setActivities] = useState<Activity[]>([]);
 const [team, setTeam] = useState<{name: string; description?: string; status: string} | null>(null);
 const [error, setError] = useState("");
 useEffect(() => {
  if (typeof router.query.id !== 'string') return;
  let active = true;
  const id = router.query.id;
  api.getTeam(id).then(data => { if (active) { setTeam(data); setTasks(data.tasks || []); setMembers(data.members || []); } }).catch(e => active && setError(e.message));
  api.getActivities(id).then(data => active && setActivities(data)).catch(e => active && setError(e.message));
  return () => { active = false; };
 }, [router.query.id]);

 const handleNavigate = (_navId: string) => {
 router.push("/");
 };

 const todoTasks = tasks.filter((t) => t.status === "backlog");
 const inProgressTasks = tasks.filter((t) => t.status === "in_progress");
 const doneTasks = tasks.filter((t) => t.status === "done");

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
 <span className="text-sm text-slate-400">0 dependencies</span>
 </div>
 </div>

 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
 <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-slate-400">Todo</span>
 <span className="text-lg font-semibold text-white">{todoTasks.length}</span>
 </div>
 {todoTasks.map((t) => (
 <div key={t.id} className="text-sm text-slate-300 p-2 bg-slate-800 rounded border border-slate-700 mt-2">
 {t.title}
 <span className={"ml-2 text-xs px-1.5 py-0.5 rounded " + statusBadge(t.status)}>{t.status}</span>
 </div>
 ))}
 </div>

 <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-slate-400">In Progress</span>
 <span className="text-lg font-semibold text-white">{inProgressTasks.length}</span>
 </div>
 {inProgressTasks.map((t) => (
 <div key={t.id} className="text-sm text-slate-300 p-2 bg-slate-800 rounded border border-slate-700 mt-2">
 {t.title}
 <span className={"ml-2 text-xs px-1.5 py-0.5 rounded " + statusBadge(t.status)}>{t.status}</span>
 </div>
 ))}
 </div>

 <div className="bg-slate-800/50 rounded-lg p-4 border border-slate-700">
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-slate-400">Done</span>
 <span className="text-lg font-semibold text-white">{doneTasks.length}</span>
 </div>
 {doneTasks.map((t) => (
 <div key={t.id} className="text-sm text-slate-300 p-2 bg-slate-800 rounded border border-slate-700 mt-2">
 {t.title}
 <span className={"ml-2 text-xs px-1.5 py-0.5 rounded " + statusBadge(t.status)}>{t.status}</span>
 </div>
 ))}
 </div>
 </div>

 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg overflow-hidden">
 <div className="px-4 py-3 border-b border-slate-700">
 <h2 className="text-lg font-semibold text-white">Team Members</h2>
 </div>
 <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-3">
 {members.map((member) => (
 <div key={member.id} className="bg-slate-800/50 rounded-lg p-4 border border-slate-700 flex items-center gap-3">
 <div className={"w-10 h-10 rounded-full flex items-center justify-center text-white " + (member.type === "ai" ? "bg-purple-500" : "bg-blue-500")}>
 {member.type === "ai" ? <FaRobot className="w-5 h-5" /> : <FaUser className="w-5 h-5" />}
 </div>
 <div>
 <p className="text-sm font-medium text-white">{member.name}</p>
 <p className="text-xs text-slate-400">{member.role}</p>
 </div>
 </div>
 ))}
 </div>
 </div>

 <div>
 <h2 className="text-lg font-semibold text-white mb-3">Recent Activity</h2>
 <ActivityFeed activities={activities} maxHeight="400px" />
 </div>
 </div>
 </Layout>
 );
};

export default TeamProgress;
