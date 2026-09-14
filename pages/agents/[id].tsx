import {onDashboardChange} from '@/lib/socket-client';
import React from "react";
import { useRouter } from "next/router";
import type { Agent, Activity, Member } from "@/types";
import Layout from "@/components/Layout";
import AgentCard from "@/components/AgentCard";
import ActivityFeed from "@/components/ActivityFeed";
import {
 FaMicrochip,
 FaClock,
 FaCheckSquare,
 FaGitAlt,
 FaChevronRight,
 FaFileAlt,
 FaArrowLeft,
 FaBolt,
 FaExclamationTriangle,
 FaCodeBranch,
 FaSpinner,
} from "react-icons/fa";
import api from "@/lib/api-client";

const AgentProgress: React.FC = () => {
 const router = useRouter();
 const { id } = router.query;

 const [agent, setAgent] = React.useState<Agent | null>(null);
 const [activities, setActivities] = React.useState<Activity[]>([]);
 const [loading, setLoading] = React.useState(true);
 const [error, setError] = React.useState<string | null>(null);

 React.useEffect(() => {
 if (!id || typeof id !== "string") return;

 let cancelled = false;

 async function loadData() {
 
 setError(null);
 try {
 const [agentData, allActivities] = await Promise.all([
 api.getAgent(String(id)),
 api.getActivities(),
 ]);

 if (cancelled) return;

 setAgent(agentData as Agent);

 // Filter activities to this agent's member
 const member = (agentData as any).member as Member | undefined;
 const memberId = member?.id;
 const filtered = (allActivities as Activity[]).filter(
 (a: Activity) => a.meta?.agentId === id || (memberId ? a.memberId === memberId : false)
 );
 setActivities(filtered);
 } catch (err: any) {
 if (!cancelled) setError(err.message || "Failed to load agent data");
 } finally {
 if (!cancelled) setLoading(false);
 }
 }

 loadData();
 const unsubscribe = onDashboardChange(loadData);
 return () => { cancelled = true; unsubscribe(); };
 }, [id]);

 const handleNavigate = (_navId: string) => {
 router.push("/");
 };

 if (loading) {
 return (
 <Layout activeNav="agents" onNavigate={handleNavigate}>
 <div className="flex items-center justify-center h-64">
 <FaSpinner className="w-8 h-8 text-blue-400 animate-spin" />
 </div>
 </Layout>
 );
 }

 if (error || !agent) {
 return (
 <Layout activeNav="agents" onNavigate={handleNavigate}>
 <button
 onClick={() => router.back()}
 className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4 transition-colors"
 >
 <FaArrowLeft className="w-4 h-4" />
 Back
 </button>
 <div className="bg-[#1a1d2e] border border-red-500/30 rounded-lg p-6 text-center">
 <p className="text-red-400">{error || "Agent not found"}</p>
 </div>
 </Layout>
 );
 }

 const member = (agent as any).member as Member | undefined;
 const tasks = (agent as any).tasks || [];
 const tasksCompleted = tasks.filter((t: any) => t.status === "done").length;
 const tokensUsed = activities.reduce((sum, a) => sum + Number((a.meta?.usage as any)?.totalTokens ?? a.meta?.tokensUsed ?? 0), 0);
 const avgTaskTime = "Unavailable";
 const successRate = tasks.length > 0 ? Math.round((tasksCompleted / tasks.length) * 100) : 0;
 const agentName = agent.name;
 const agentRole = member?.role || "AI Agent";
 const agentModel = agent.model;
 const agentStatus = agent.status;

 return (
 <Layout activeNav="agents" onNavigate={handleNavigate}>
 <button
 onClick={() => router.back()}
 className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4 transition-colors"
 >
 <FaArrowLeft className="w-4 h-4" />
 Back
 </button>

 <div className="space-y-6">
 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-6">
 <div className="flex items-start justify-between mb-4">
 <div className="flex items-center gap-4">
 <div className="w-16 h-16 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center text-2xl text-white font-bold">
 {agentName.charAt(0)}
 </div>
 <div>
 <h1 className="text-2xl font-bold text-white">{agentName}</h1>
 <p className="text-sm text-slate-400">
 {agentRole} • {agentModel}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <span
 className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 ${
 agentStatus === "working"
 ? "bg-green-400/10 text-green-400"
 : agentStatus === "error"
 ? "bg-red-400/10 text-red-400"
 : "bg-yellow-400/10 text-yellow-400"
 }`}
 >
 <FaCheckSquare className="w-3 h-3" />
 {agentStatus === "working" ? "Active" : agentStatus}
 </span>
 </div>
 </div>
 <p className="text-sm text-slate-400 mb-4">
 {agent.config?.systemPrompt || "Configure this agent’s provider in Settings. Runs return model output for human review."}
 </p>
 <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
 <div className="bg-slate-800/50 rounded-lg p-3">
 <p className="text-xs text-slate-400 mb-1">Tasks Completed</p>
 <p className="text-lg font-semibold text-white">{tasksCompleted}</p>
 </div>
 <div className="bg-slate-800/50 rounded-lg p-3">
 <p className="text-xs text-slate-400 mb-1">Tokens Used</p>
 <p className="text-lg font-semibold text-white">{(tokensUsed / 1000).toFixed(0)}k</p>
 </div>
 <div className="bg-slate-800/50 rounded-lg p-3">
 <p className="text-xs text-slate-400 mb-1">Avg Task Time</p>
 <p className="text-lg font-semibold text-white">{avgTaskTime}</p>
 </div>
 <div className="bg-slate-800/50 rounded-lg p-3">
 <p className="text-xs text-slate-400 mb-1">Success Rate</p>
 <p className="text-lg font-semibold text-green-400">{successRate}%</p>
 </div>
 </div>
 </div>

 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg overflow-hidden">
 <div className="px-4 py-3 border-b border-slate-700 flex items-center justify-between">
 <h2 className="text-lg font-semibold text-white">Recent Activity</h2>
 <button className="text-xs text-blue-400 hover:text-blue-300 flex items-center gap-1">
 View Full History <FaChevronRight className="w-3 h-3" />
 </button>
 </div>
 <ActivityFeed activities={activities} live={!error} maxHeight="400px" />
 </div>

 <section className="space-y-3"><h2 className="text-xl">Assigned tasks</h2>{tasks.map((t: {id:string;title:string;status:string}) => <div key={t.id} className="p-3 bg-slate-800 rounded">{t.title} — {t.status}<button disabled={agent.status === 'working' || t.status === 'done'} className="ml-4 text-blue-400 disabled:text-slate-500" onClick={async () => {try {await api.startAgent(agent.id,t.id);setAgent({...agent,status:'working'});} catch(e) {setError((e as Error).message);}}}>Run task</button></div>)}
 {agent.status === 'working' && <button className="bg-red-700 rounded px-3 py-2" onClick={async () => {try {await api.stopAgent(agent.id);setAgent({...agent,status:'idle'});} catch(e) {setError((e as Error).message);}}}>Stop agent</button>}
 <p className="text-slate-400">Assign a task from the Tasks page before running it. Runs generate a response; they do not edit a repository or execute tools.</p>
 </section>
 </div></Layout>);
};
export default AgentProgress;
