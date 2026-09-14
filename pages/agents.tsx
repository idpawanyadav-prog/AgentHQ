import CreateRecord from "@/components/CreateRecord";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { Agent } from "@/types";
import Layout from "@/components/Layout";
import AgentCard from "@/components/AgentCard";
import { FaPlus, FaSearch, FaSlidersH } from "react-icons/fa";
import api from "@/lib/api-client";

const AgentsPage: React.FC = () => {
	const router = useRouter();
	const [agents, setAgents] = useState<Agent[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		async function loadAgents() {
			try {
				const data = await api.getAgents();
				if (!cancelled) {setAgents(data);setError(null);}
			} catch (err) {
				if (!cancelled) setError(err instanceof Error ? err.message : "Failed to load agents");
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		loadAgents();
 const timer = setInterval(loadAgents, 2000);
		return () => { cancelled = true; clearInterval(timer); };
	}, []);

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

 const handleAgentClick = (agentId: string) => {
 router.push(`/agents/${agentId}`);
 };

 const workingCount = agents.filter((a) => a.status === "working").length;
 const idleCount = agents.filter((a) => a.status === "idle").length;
 const errorCount = agents.filter((a) => a.status === "error").length;

 return (
 <Layout activeNav="agents" onNavigate={handleNavigate}>
 <div className="space-y-6">
 <div className="flex items-center justify-between">
 <div>
 <h1 className="text-2xl font-bold text-white">Agents</h1>
 <p className="text-sm text-slate-400 mt-1">Manage AI agents, their models, and performance.</p>
 </div>
 <div className="flex items-center gap-2">
 <CreateRecord kind="agent" onCreated={() => router.reload()} />
 </div>
 </div>

 <div className="flex items-center gap-6">
 <div className="flex items-center gap-4">
 <div className="flex items-center gap-1.5">
 <span className="w-2 h-2 rounded-full bg-green-400" />
 <span className="text-sm text-slate-400">{workingCount} working</span>
 </div>
 <div className="flex items-center gap-1.5">
 <span className="w-2 h-2 rounded-full bg-slate-400" />
 <span className="text-sm text-slate-400">{idleCount} idle</span>
 </div>
 <div className="flex items-center gap-1.5">
 <span className="w-2 h-2 rounded-full bg-red-400" />
 <span className="text-sm text-slate-400">{errorCount} error</span>
 </div>
 </div>
 </div>

 {loading && (
 <div className="text-center py-12 text-slate-400">Loading agents...</div>
 )}

 {error && (
 <div className="text-center py-12 text-red-400">{error}</div>
 )}

 {!loading && !error && agents.length === 0 && (
 <div className="text-center py-12 text-slate-400">No agents found.</div>
 )}

 <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
 {agents.map((agent) => (
 <div key={agent.id} onClick={() => handleAgentClick(agent.id)} className="cursor-pointer">
 <AgentCard agent={agent} />
 </div>
 ))}
 </div>
 </div>
 </Layout>
 );
};

export default AgentsPage;
