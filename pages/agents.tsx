import { onDashboardChange } from '@/lib/socket-client';
import CreateRecord from '@/components/CreateRecord';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { Agent, ConfiguredModel, RoleGroup, Team } from '@/types';
import Layout from '@/components/Layout';
import api from '@/lib/api-client';
import {
 FaEdit,
 FaTimes,
 FaMicrochip,
 FaSearch,
 FaTrash,
} from 'react-icons/fa';

type AgentEditForm = {
	name: string;
	teamId: string;
	configuredModelId: string;
	roleGroupId: string;
	temperature: string;
	maxTokens: string;
	systemPrompt: string;
};

const STATUS_CONFIG: Record<string, { color: string; dot: string; label: string }> = {
	working: { color: "text-emerald-400", dot: "bg-emerald-400", label: "Working" },
	idle: { color: "text-slate-400", dot: "bg-slate-400", label: "Idle" },
	error: { color: "text-red-400", dot: "bg-red-400", label: "Error" },
};

const PROVIDER_STYLES: Record<string, { iconBg: string; badge: string }> = {
	anthropic: { iconBg: "#a855f7", badge: "model-badge-anthropic" },
	openai: { iconBg: "#3b82f6", badge: "model-badge-openai" },
	custom: { iconBg: "#14b8a6", badge: "model-badge-openai" },
};

const AgentsPage: React.FC = () => {
	const router = useRouter();
	const [agents, setAgents] = useState<Agent[]>([]);
	const [teams, setTeams] = useState<Team[]>([]);
	const [models, setModels] = useState<ConfiguredModel[]>([]);
	const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
	const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
	const [editForm, setEditForm] = useState<AgentEditForm | null>(null);
	const [editError, setEditError] = useState('');
	const [savingEdit, setSavingEdit] = useState(false);
	const [actionError, setActionError] = useState('');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [searchQuery, setSearchQuery] = useState("");
	const [statusFilter, setStatusFilter] = useState("All Statuses");
	const [providerFilter, setProviderFilter] = useState("All Providers");
	const [selectedAgentId, setSelectedAgentId] = useState<string>("");

	const teamMap = teams.reduce<Record<string, string>>((acc, t) => {
		acc[t.id] = t.name;
		return acc;
	}, {});

	const roleGroupForAgent = (agentId: string) =>
		roleGroups.find((g) => g.assignments.some((a) => a.agentId === agentId));

	const agentStats = (agent: Agent) => {
		const tasks = agent.tasks || [];
		const doneCount = tasks.filter((t) => t.status === "done").length;
		const prCount = new Set(tasks.filter((t) => t.prNumber != null).map((t) => t.prNumber)).size;
		return { doneCount, prCount };
	};

	const statusesList = Array.from(new Set(agents.map((a) => a.status))).sort();
	const providersList = Array.from(new Set(agents.map((a) => a.type))).sort();

	const filtered = agents.filter((agent) => {
		const rg = roleGroupForAgent(agent.id);
		const matchesSearch =
			!searchQuery ||
			agent.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
			agent.model.toLowerCase().includes(searchQuery.toLowerCase()) ||
			(rg?.name || "").toLowerCase().includes(searchQuery.toLowerCase());
		const matchesStatus = statusFilter === "All Statuses" || agent.status === statusFilter;
		const matchesProvider = providerFilter === "All Providers" || agent.type === providerFilter;
		return matchesSearch && matchesStatus && matchesProvider;
	});

	const loadReferenceData = async () => {
		const [teamData, modelData, groupData] = await Promise.all([
			api.getTeams(),
			api.getModels(),
			api.getRoleGroups(),
		]);
		const nextTeams = Array.isArray(teamData) ? teamData : [];
		const nextModels = Array.isArray(modelData) ? modelData : [];
		const nextGroups = Array.isArray(groupData) ? groupData : [];
		setTeams(nextTeams);
		setModels(nextModels);
		setRoleGroups(nextGroups);
		return { teams: nextTeams, models: nextModels, groups: nextGroups };
	};

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

	useEffect(() => {
		loadReferenceData().catch(() => undefined);
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

	const currentRoleGroupIdForAgent = (agentId: string) =>
		roleGroups.find((group) =>
			group.assignments.some((assignment) => assignment.agentId === agentId)
		)?.id || '';

	const roleGroupIdForAgent = (groups: RoleGroup[], agentId: string) =>
		groups.find((group) =>
			group.assignments.some((assignment) => assignment.agentId === agentId)
		)?.id || '';

	const openEditAgent = async (agent: Agent) => {
		setEditError('');
		try {
			const { models: nextModels, groups } = await loadReferenceData();
			const freshAgent = await api.getAgent(agent.id) as Agent;
			const config = freshAgent.config || {};
			const configuredModel = nextModels.find((model) => model.id === config.configuredModelId)
				|| nextModels.find((model) => model.provider === freshAgent.type && model.modelId === freshAgent.model);
			setEditingAgent(freshAgent);
			setEditForm({
				name: freshAgent.name,
				teamId: (freshAgent as any).member?.teamId || '',
				configuredModelId: configuredModel?.id || '',
				roleGroupId: roleGroupIdForAgent(groups, freshAgent.id),
				temperature: String(config.temperature ?? 0.7),
				maxTokens: String(config.maxTokens ?? 4096),
				systemPrompt: config.systemPrompt || '',
			});
		} catch (err) {
			setEditError(err instanceof Error ? err.message : 'Failed to load agent');
		}
	};

	const closeEditAgent = () => {
		setEditingAgent(null);
		setEditForm(null);
		setEditError('');
	};

	const saveEditedAgent = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!editingAgent || !editForm) return;
		const selectedModel = models.find((model) => model.id === editForm.configuredModelId);
		if (!selectedModel) {
			setEditError('Select a configured model');
			return;
		}
		setSavingEdit(true);
		setEditError('');
		try {
			const nextConfig = {
				...(editingAgent.config || {}),
				gatewayId: selectedModel.gatewayId,
				configuredModelId: selectedModel.id,
				temperature: Number(editForm.temperature),
				maxTokens: Number(editForm.maxTokens),
				systemPrompt: editForm.systemPrompt,
			};
			const savedAgent = await api.updateAgent(editingAgent.id, {
				name: editForm.name.trim(),
				teamId: editForm.teamId,
				type: selectedModel.provider,
				model: selectedModel.modelId,
				config: nextConfig,
			}) as Agent;

			const currentRoleGroupId = currentRoleGroupIdForAgent(editingAgent.id);
			if (currentRoleGroupId && currentRoleGroupId !== editForm.roleGroupId) {
				await api.removeAssignment(currentRoleGroupId, editingAgent.id);
			}
			if (editForm.roleGroupId) {
				await api.assignAgent(editForm.roleGroupId, {
					agentId: editingAgent.id,
					agentName: editForm.name.trim(),
					agentStatus: savedAgent.status,
				});
			}

			setAgents((prev) => prev.map((agent) => (agent.id === savedAgent.id ? savedAgent : agent)));
			await loadReferenceData();
			closeEditAgent();
		} catch (err) {
			setEditError(err instanceof Error ? err.message : 'Failed to save agent');
		} finally {
			setSavingEdit(false);
		}
	};

	const deleteAgent = async (agent: Agent) => {
		if (!window.confirm(`Delete agent "${agent.name}"? Tasks assigned to this agent will be unassigned.`)) return;
		setActionError('');
		try {
			await api.deleteAgent(agent.id);
			setAgents((prev) => prev.filter((item) => item.id !== agent.id));
			setRoleGroups((prev) => prev.map((group) => ({
				...group,
				assignments: group.assignments.filter((assignment) => assignment.agentId !== agent.id),
			})));
			if (selectedAgentId === agent.id) setSelectedAgentId('');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Failed to delete agent');
		}
	};

	const workingCount = agents.filter((a) => a.status === 'working').length;
	const idleCount = agents.filter((a) => a.status === 'idle').length;
	const errorCount = agents.filter((a) => a.status === 'error').length;

	// Loading / Error states
	if (loading) {
		return (
			<Layout activeNav="agents" onNavigate={handleNavigate}>
				<div className="px-6 py-20 flex items-center justify-center">
					<div className="flex flex-col items-center gap-3">
						<div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
						<p className="text-sm text-slate-400">Loading agents...</p>
					</div>
				</div>
			</Layout>
		);
	}

	if (error) {
		return (
			<Layout activeNav="agents" onNavigate={handleNavigate}>
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

	return (
		<Layout activeNav="agents" onNavigate={handleNavigate}>
			<div className="px-6">
				{/* Page Header */}
				<div>
					<div>
						<h1 className="text-2xl font-bold text-[var(--text-primary)] mb-1">Agents</h1>
						<p className="text-sm text-slate-400">
							Manage AI agents, their models, and performance.
						</p>
					</div>
					<div className="flex items-center gap-2 flex-nowrap mb-4">
						<div className="flex items-center gap-4 mr-2">
							<div className="flex items-center gap-1.5">
								<span className="w-2 h-2 rounded-full bg-green-400" />
								<span className="text-xs text-slate-400">{workingCount} working</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="w-2 h-2 rounded-full bg-slate-400" />
								<span className="text-xs text-slate-400">{idleCount} idle</span>
							</div>
							<div className="flex items-center gap-1.5">
								<span className="w-2 h-2 rounded-full bg-red-400" />
								<span className="text-xs text-slate-400">{errorCount} error</span>
							</div>
						</div>
						<div className="relative h-8">
							<FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search agents..."
								className="input-field pl-8 w-36 text-xs h-full"
							/>
						</div>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="input-field text-xs py-1.5 pl-2 pr-7 h-8"
						>
							<option>All Statuses</option>
							{statusesList.map((s) => (
								<option key={s} value={s}>{STATUS_CONFIG[s]?.label || s}</option>
							))}
						</select>
						<select
							value={providerFilter}
							onChange={(e) => setProviderFilter(e.target.value)}
							className="input-field text-xs py-1.5 pl-2 pr-7 h-8"
						>
							<option>All Providers</option>
							{providersList.map((p) => (
								<option key={p} value={p}>{p}</option>
							))}
						</select>
						<CreateRecord kind="agent" onCreated={() => router.reload()} />
					</div>
				</div>

				{agents.length === 0 && !error && (
					<div className="page-panel text-center py-12 text-[var(--text-secondary)] text-sm">
						No agents found.
					</div>
				)}

				{actionError && (
					<p role="alert" className="mb-4 text-sm text-red-400">{actionError}</p>
				)}

				{agents.length > 0 && (
					<>
						{/* Agent Table */}
						<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
						<div className="overflow-x-auto">
						<table className="w-full text-sm">
						<thead>
						<tr className="border-b border-[var(--border-default)] text-left text-xs text-slate-400 uppercase tracking-wider">
						<th className="p-3">Name</th>
						<th className="p-3">Model</th>
						<th className="p-3">Provider</th>
						<th className="p-3">Role Group</th>
						<th className="p-3">Status</th>
						<th className="p-3">Temp</th>
						<th className="p-3">Max Tokens</th>
						<th className="p-3 text-right">Tasks</th>
						<th className="p-3 text-right">PRs</th>
						<th className="p-3 w-20"></th>
						</tr>
						</thead>
						<tbody>
						{filtered.map((agent) => {
							const isSelected = selectedAgentId === agent.id;
							const statusCfg = STATUS_CONFIG[agent.status] || STATUS_CONFIG.idle;
							const providerStyle = PROVIDER_STYLES[agent.type] || PROVIDER_STYLES.anthropic;
							const rg = roleGroupForAgent(agent.id);
							const stats = agentStats(agent);

							return (
							<tr
								key={agent.id}
								onClick={() => { setSelectedAgentId(agent.id); handleAgentClick(agent.id); }}
								className={`border-b border-[var(--border-default)]/50 cursor-pointer transition-colors ${
									isSelected ? "bg-blue-500/10" : "hover:bg-[var(--bg-secondary)]/40"
								}`}
							>
							<td className="p-3">
								<div className="flex items-center gap-2">
									<div
										className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
										style={{ backgroundColor: providerStyle.iconBg }}
									>
										<FaMicrochip className="w-4 h-4 text-white" />
									</div>
									<div>
										<span className={`font-medium ${isSelected ? "text-blue-300" : "text-[var(--text-primary)]"}`}>{agent.name}</span>
										<span className="text-xs text-slate-500 block">{agent.id}</span>
									</div>
								</div>
							</td>
							<td className="p-3 text-slate-300">{agent.model}</td>
							<td className="p-3">
								<span className={`text-xs ${providerStyle.badge}`}>{agent.type}</span>
							</td>
							<td className="p-3 text-slate-300">{rg?.name || "—"}</td>
							<td className="p-3">
								<span className={`inline-flex items-center gap-1.5 text-xs ${statusCfg.color}`}>
									<span className={`w-2 h-2 rounded-full ${statusCfg.dot}`} />
									{statusCfg.label}
								</span>
							</td>
							<td className="p-3 text-slate-300 text-xs">{agent.config.temperature ?? 0.7}</td>
							<td className="p-3 text-slate-300 text-xs">{agent.config.maxTokens ?? 4096}</td>
							<td className="p-3 text-right text-slate-300 text-xs">{stats.doneCount}</td>
							<td className="p-3 text-right text-slate-300 text-xs">{stats.prCount}</td>
							<td className="p-3">
								<div className="flex items-center justify-end gap-1">
									<button
										type="button"
										onClick={(e) => { e.stopPropagation(); openEditAgent(agent); }}
										className="text-slate-400 hover:text-blue-400 p-1"
										title="Edit agent"
									>
										<FaEdit className="w-3.5 h-3.5" />
									</button>
									<button
										type="button"
										onClick={(e) => { e.stopPropagation(); deleteAgent(agent); }}
										disabled={agent.status === 'working'}
										className="text-red-400 hover:text-red-300 disabled:opacity-40 disabled:cursor-not-allowed p-1"
										title={agent.status === 'working' ? 'Stop agent before deleting' : 'Delete agent'}
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

						{/* Pagination-like summary */}
						<div className="flex items-center justify-between mt-4">
							<p className="text-xs text-slate-400">
								Showing {filtered.length} of {agents.length} agents
							</p>
						</div>
					</>
				)}
			</div>

			{editingAgent && editForm && (
				<div className="fixed inset-0 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 50, backdropFilter: 'blur(4px)' }}>
					<form onSubmit={saveEditedAgent} role="dialog" aria-modal="true" aria-label="Edit agent" className="page-panel w-full max-w-2xl space-y-4">
						<div className="flex items-center justify-between">
							<h2 className="text-xl font-semibold text-[var(--text-primary)]">Edit Agent</h2>
							<button type="button" onClick={closeEditAgent} className="p-1.5 text-slate-400 hover:text-[var(--text-primary)] rounded">
								<FaTimes className="w-4 h-4" />
							</button>
						</div>

						<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
							<label className="block">
								Name
								<input value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} required className="input-field mt-1" />
							</label>
							<label className="block">
								Team
								<select value={editForm.teamId} onChange={(e) => setEditForm({ ...editForm, teamId: e.target.value })} required className="input-field mt-1">
									<option value="">Select team...</option>
									{teams.map((team) => <option key={team.id} value={team.id}>{team.name}</option>)}
								</select>
							</label>
							<label className="block">
								Model
								<select value={editForm.configuredModelId} onChange={(e) => setEditForm({ ...editForm, configuredModelId: e.target.value })} required className="input-field mt-1">
									<option value="">Select configured model...</option>
									{models.map((model) => (
										<option key={model.id} value={model.id}>{model.name} ({model.gatewayName} / {model.modelId})</option>
									))}
								</select>
							</label>
							<label className="block">
								Role Group
								<select value={editForm.roleGroupId} onChange={(e) => setEditForm({ ...editForm, roleGroupId: e.target.value })} className="input-field mt-1">
									<option value="">No role group</option>
									{roleGroups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}
								</select>
							</label>
							<label className="block">
								Temperature
								<input type="number" min="0" max="2" step="0.1" value={editForm.temperature} onChange={(e) => setEditForm({ ...editForm, temperature: e.target.value })} className="input-field mt-1" />
							</label>
							<label className="block">
								Max Tokens
								<input type="number" min="1" step="1" value={editForm.maxTokens} onChange={(e) => setEditForm({ ...editForm, maxTokens: e.target.value })} className="input-field mt-1" />
							</label>
						</div>

						<label className="block">
							System Prompt
							<textarea value={editForm.systemPrompt} onChange={(e) => setEditForm({ ...editForm, systemPrompt: e.target.value })} className="input-field mt-1" rows={5} />
						</label>

						{editError && <p role="alert" className="text-sm text-red-400">{editError}</p>}
						<div className="flex items-center gap-3 pt-2">
							<button type="submit" disabled={savingEdit} className="btn-primary">{savingEdit ? 'Saving...' : 'Save Agent'}</button>
							<button type="button" disabled={savingEdit} onClick={closeEditAgent} className="btn-secondary">Cancel</button>
						</div>
					</form>
				</div>
			)}
		</Layout>
	);
};

export default AgentsPage;
