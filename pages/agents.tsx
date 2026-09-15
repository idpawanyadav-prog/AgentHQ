import { onDashboardChange } from '@/lib/socket-client';
import CreateRecord from '@/components/CreateRecord';
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { Agent, ConfiguredModel, RoleGroup, Team } from '@/types';
import Layout from '@/components/Layout';
import AgentCard from '@/components/AgentCard';
import api from '@/lib/api-client';
import { FaEdit, FaTimes } from 'react-icons/fa';

type AgentEditForm = {
	name: string;
	teamId: string;
	configuredModelId: string;
	roleGroupId: string;
	temperature: string;
	maxTokens: string;
	systemPrompt: string;
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
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);

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
			const { groups } = await loadReferenceData();
			const freshAgent = await api.getAgent(agent.id) as Agent;
			const config = freshAgent.config || {};
			setEditingAgent(freshAgent);
			setEditForm({
				name: freshAgent.name,
				teamId: (freshAgent as any).member?.teamId || '',
				configuredModelId: config.configuredModelId || '',
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
							className="cursor-pointer relative group"
						>
							<button
								type="button"
								onClick={(event) => {
									event.stopPropagation();
									openEditAgent(agent);
								}}
								className="absolute right-3 top-3 z-10 p-2 rounded-md bg-[var(--surface-card)]/90 border border-[var(--border-default)] text-slate-400 hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
								title="Edit agent"
							>
								<FaEdit className="w-3.5 h-3.5" />
							</button>
							<AgentCard agent={agent} />
						</div>
					))}
				</div>
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
