import { onDashboardChange } from '@/lib/socket-client';
import CreateRecord from '@/components/CreateRecord';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { Agent } from '@/types';
import Layout from '@/components/Layout';
import AgentCard from '@/components/AgentCard';
import api from '@/lib/api-client';

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
				if (!cancelled) {
					setAgents(data);
					setError(null);
				}
			} catch (err) {
				if (!cancelled)
					setError(err instanceof Error ? err.message : 'Failed to load agents');
			} finally {
				if (!cancelled) setLoading(false);
			}
		}
		loadAgents();
		const unsubscribe = onDashboardChange(loadAgents);
		return () => {
			cancelled = true;
			unsubscribe();
		};
	}, []);

	const handleNavigate = (item: string) => {
		const navHref: Record<string, string> = {
			overview: '/',
			teams: '/teams',
			tasks: '/tasks',
			agents: '/agents',
			projects: '/projects',
			activity: '/activity',
			settings: '/settings',
			sprints: '/sprints',
		};
		router.push(navHref[item] || '/');
	};

	const handleAgentClick = (agentId: string) => {
		router.push(`/agents/${agentId}`);
	};

	const workingCount = agents.filter((a) => a.status === 'working').length;
	const idleCount = agents.filter((a) => a.status === 'idle').length;
	const errorCount = agents.filter((a) => a.status === 'error').length;

	return (
		<Layout activeNav="agents" onNavigate={handleNavigate}>
			<div className="space-y-6 transition-colors duration-200">
				<div className="flex items-center justify-between">
					<div>
						<h1 className="text-2xl font-bold text-[var(--text-primary)]">Agents</h1>
						<p className="text-sm text-[var(--text-secondary)] mt-1">
							Manage AI agents, their models, and performance.
						</p>
					</div>
					<CreateRecord kind="agent" onCreated={() => router.reload()} />
				</div>

				<div className="flex items-center gap-6">
					<div className="flex items-center gap-1.5">
						<span className="w-2 h-2 rounded-full bg-green-400" />
						<span className="text-sm text-[var(--text-secondary)]">{workingCount} working</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="w-2 h-2 rounded-full bg-slate-400" />
						<span className="text-sm text-[var(--text-secondary)]">{idleCount} idle</span>
					</div>
					<div className="flex items-center gap-1.5">
						<span className="w-2 h-2 rounded-full bg-red-400" />
						<span className="text-sm text-[var(--text-secondary)]">{errorCount} error</span>
					</div>
				</div>

				{loading && (
					<div className="page-panel text-center py-12 text-[var(--text-secondary)] text-sm">
						Loading agents...
					</div>
				)}

				{error && (
					<div className="page-panel text-center py-12 status-badge error">
						{error}
					</div>
				)}

				{!loading && !error && agents.length === 0 && (
					<div className="page-panel text-center py-12 text-[var(--text-secondary)] text-sm">
						No agents found.
					</div>
				)}

				<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
					{agents.map((agent) => (
						<div
							key={agent.id}
							onClick={() => handleAgentClick(agent.id)}
							className="cursor-pointer"
						>
							<AgentCard agent={agent} />
						</div>
					))}
				</div>
			</div>
		</Layout>
	);
};

export default AgentsPage;
