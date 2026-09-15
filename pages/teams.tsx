import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import type { Team, TeamMemberInfo } from '@/types';
import api from '@/lib/api-client';
import Layout from '@/components/Layout';
import TeamCard from '@/components/TeamCard';
import {
	FaSearch,
	FaFilter,
	FaPlus,
	FaUsers,
	FaCheckCircle,
	FaClock,
	FaCalendar,
	FaTasks,
	FaEllipsisH,
	FaChartPie,
	FaFileAlt,
	FaArrowRight,
	FaTimes,
} from 'react-icons/fa';
import InteractiveDonut from '@/components/InteractiveDonut';

const SORT_OPTIONS = [
	{ value: 'name', label: 'Sort by: Name' },
	{ value: 'status', label: 'Sort by: Status' },
	{ value: 'sprint', label: 'Sort by: Sprint' },
];

const STATUS_FILTER_OPTIONS = [
	{ value: 'all', label: 'All Teams' },
	{ value: 'active', label: 'Active' },
	{ value: 'paused', label: 'On Hold' },
	{ value: 'archived', label: 'Archived' },
];

// Convert Activity to display shape for the activity feed
function activityToDisplay(activity: any) {
	return {
		id: activity.id,
		description: activity.description,
		timestamp: new Date(activity.createdAt).toLocaleString('en-US', {
			month: 'short',
			day: 'numeric',
			hour: '2-digit',
			minute: '2-digit',
		}),
		letter: activity.member?.name?.charAt(0) || '?',
		teamColor: 'blue',
	};
}

// Enrich raw API team data to match TeamCard's expected shape
function enrichTeam(raw: any): Team {
	const letter = (raw.id || 'A').charAt(0).toUpperCase();
	const teamColor = (raw.id?.includes('alpha') || raw.id?.includes('beta'))
		? 'blue'
		: raw.id?.includes('gamma')
			? 'orange'
			: raw.id?.includes('delta')
				? 'green'
				: 'purple';
	const membersByDisplayKey = new Map<string, any>();
	for (const member of raw.members || []) {
		const key = `${member.name || ''}|${member.type || ''}|${member.role || ''}`;
		const existing = membersByDisplayKey.get(key);
		const memberAgentCount = member.agents?.length || 0;
		const existingAgentCount = existing?.agents?.length || 0;
		if (!existing || memberAgentCount > existingAgentCount) {
			membersByDisplayKey.set(key, member);
		}
	}
	const members = Array.from(membersByDisplayKey.values());
	const displayMembers = members.filter((member: any) => member.type !== 'ai' || (member.agents?.length || 0) > 0);

	return {
		id: raw.id,
		name: raw.name,
		description: raw.description || '',
		status: raw.status || 'active',
		letter: letter as Team['letter'],
		teamColor: teamColor as Team['teamColor'],
		sprint: raw.tasks?.length ? 1 : 0,
		sprintOf: 4,
		sprintProgress: raw.sprintProgress ?? 0,
		daysLeft: null,
		activeSprints: raw.tasks?.filter((t: any) => t.status === 'in_progress').length || 0,
		openTasks: raw.tasks?.filter((t: any) => t.status !== 'done' && t.status !== 'completed').length || 0,
		completed: raw.tasks?.filter((t: any) => t.status === 'done' || t.status === 'completed').length || 0,
		features: 0,
		integrations: 0,
		issues: raw.tasks?.filter((t: any) => t.status === 'blocked').length || 0,
		dueDate: '',
		members,
		teamMembers: displayMembers.map((m: any) => ({
			name: m.name || 'Unknown',
			model: m.agents?.[0]?.model || (m.type === 'human' ? 'Human' : 'AI'),
		})),
		tasks: raw.tasks || [],
		createdAt: raw.createdAt || '',
		updatedAt: raw.updatedAt || '',
	};
}

const Teams: React.FC = () => {
	const router = useRouter();
	const [searchQuery, setSearchQuery] = useState('');
	const [statusFilter, setStatusFilter] = useState('all');
	const [sortBy, setSortBy] = useState('name');
	const [showNewTeamModal, setShowNewTeamModal] = useState(false);
	const [teams, setTeams] = useState<Team[]>([]);
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState<string | null>(null);
	const [activities, setActivities] = useState<any[]>([]);
	const [creating, setCreating] = useState(false);
	const [editingTeam, setEditingTeam] = useState<Team | null>(null);
	const [savingTeam, setSavingTeam] = useState(false);
	const [actionMessage, setActionMessage] = useState<string | null>(null);
	const [actionError, setActionError] = useState<string | null>(null);

	const loadData = async () => {
		setLoading(true);
		setError(null);
		try {
			const [teamsData, activitiesData] = await Promise.all([api.getTeams(), api.getActivities()]);
			setTeams((teamsData as any[]).map(enrichTeam));
			setActivities(activitiesData as any[]);
		} catch (err: any) {
			console.error('Failed to load teams:', err);
			setError(err.message || 'Failed to load teams');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		let cancelled = false;
		Promise.all([api.getTeams(), api.getActivities()])
			.then(([teamsData, activitiesData]) => {
				if (cancelled) return;
				setTeams((teamsData as any[]).map(enrichTeam));
				setActivities(activitiesData as any[]);
			})
			.catch((err) => {
				if (cancelled) return;
				console.error('Failed to load teams:', err);
				setError(err.message || 'Failed to load teams');
			})
			.finally(() => {
				if (cancelled) return;
				setLoading(false);
			});
		return () => {
			cancelled = true;
		};
	}, []);

	const filteredTeams = teams
		.filter((team) => {
			const q = searchQuery.toLowerCase();
			const matchesSearch =
				team.name.toLowerCase().includes(q) ||
				(team.description || '').toLowerCase().includes(q);
			const matchesStatus = statusFilter === 'all' || team.status === statusFilter;
			return matchesSearch && matchesStatus;
		})
		.sort((a, b) => {
			if (sortBy === 'name') return a.name.localeCompare(b.name);
			if (sortBy === 'status') return a.status.localeCompare(b.status);
			if (sortBy === 'sprint') return b.sprint - a.sprint;
			return 0;
		});

	const totalTeams = teams.length;
	const activeCount = teams.filter((t) => t.status === 'active').length;
	const onHoldCount = teams.filter((t) => t.status === 'paused').length;
	const totalMembers = teams.reduce((sum, t) => sum + t.members.length, 0);

	const handleCreateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		setActionError(null);
		setCreating(true);

		const form = e.currentTarget;
		const nameInput = form.elements.namedItem('teamName') as HTMLInputElement;
		const descInput = form.elements.namedItem('teamDescription') as HTMLTextAreaElement;
		const statusInput = form.elements.namedItem('teamStatus') as HTMLSelectElement;

		const name = nameInput?.value.trim();
		const description = descInput?.value.trim() || undefined;
		const status = (statusInput?.value || 'active') as Team['status'];

		if (!name) {
			setActionError('Team name is required');
			setCreating(false);
			return;
		}

		try {
			const response = await fetch('/api/teams', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name, description, status }),
			});

			if (!response.ok) {
				const data = await response.json().catch(() => ({}));
				throw new Error(data.error || `Failed to create team (HTTP ${response.status})`);
			}

			const newTeam = await response.json();
			setTeams((prev) => [enrichTeam(newTeam), ...prev]);
			setShowNewTeamModal(false);
			setActionMessage('Team created');
			form.reset();
		} catch (err: any) {
			setActionError(err.message || 'Something went wrong');
		} finally {
			setCreating(false);
		}
	};

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

	const handleViewTeam = (team: Team) => {
		router.push(`/teams/${team.id}`);
	};

	const handleUpdateTeam = async (e: React.FormEvent<HTMLFormElement>) => {
		e.preventDefault();
		if (!editingTeam) return;
		setSavingTeam(true);
		setActionError(null);
		setActionMessage(null);
		const form = e.currentTarget;
		const name = (form.elements.namedItem('teamName') as HTMLInputElement).value.trim();
		const description = (form.elements.namedItem('teamDescription') as HTMLTextAreaElement).value.trim();
		const status = (form.elements.namedItem('teamStatus') as HTMLSelectElement).value;
		try {
			const updated = await api.updateTeam(editingTeam.id, { name, description, status });
			setTeams((prev) => prev.map((team) => team.id === editingTeam.id ? enrichTeam(updated) : team));
			setEditingTeam(null);
			setActionMessage('Team updated');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Failed to update team');
		} finally {
			setSavingTeam(false);
		}
	};

	const handleSetTeamStatus = async (team: Team, status: Team['status']) => {
		setActionError(null);
		setActionMessage(null);
		try {
			const updated = await api.updateTeam(team.id, { status });
			setTeams((prev) => prev.map((item) => item.id === team.id ? enrichTeam(updated) : item));
			setActionMessage(`Team ${status === 'archived' ? 'archived' : status === 'paused' ? 'paused' : 'activated'}`);
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Failed to update team status');
		}
	};

	const handleDeleteTeam = async (team: Team) => {
		if (!window.confirm(`Delete "${team.name}"? Teams with members or tasks must be archived instead.`)) return;
		setActionError(null);
		setActionMessage(null);
		try {
			await api.deleteTeam(team.id);
			setTeams((prev) => prev.filter((item) => item.id !== team.id));
			setActionMessage('Team deleted');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Failed to delete team');
		}
	};

	return (
		<Layout activeNav="teams" onNavigate={handleNavigate}>
			<div className="p-6 space-y-6 transition-colors duration-200">
				{/* Page header and controls */}
				<div className="flex flex-col gap-4">
					<div>
						<h1 className="text-2xl font-bold text-[var(--text-primary)]">Teams</h1>
						<p className="text-sm text-[var(--text-secondary)] mt-1">
							Manage your AI development teams, monitor sprint progress, and track team activity.
						</p>
						{actionError && (
							<p role="alert" className="mt-2 text-sm text-red-400">{actionError}</p>
						)}
					</div>
					<div className="flex flex-nowrap items-center gap-2">
						<div className="relative flex-1 min-w-[160px] max-w-xs">
							<FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[var(--text-tertiary)]" />
							<input
								type="text"
								value={searchQuery}
								onChange={(e) => setSearchQuery(e.target.value)}
								placeholder="Search teams..."
								className="search-input w-full pl-8 pr-3 py-1.5 text-xs"
							/>
						</div>
						<select
							value={statusFilter}
							onChange={(e) => setStatusFilter(e.target.value)}
							className="input-field text-xs py-1.5 pl-2 pr-7"
						>
							{STATUS_FILTER_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
						<select
							value={sortBy}
							onChange={(e) => setSortBy(e.target.value)}
							className="input-field text-xs py-1.5 pl-2 pr-7"
						>
							{SORT_OPTIONS.map((opt) => (
								<option key={opt.value} value={opt.value}>
									{opt.label}
								</option>
							))}
						</select>
						<button
							type="button"
							onClick={() => {
								setActionError(null);
								setActionMessage(null);
								setShowNewTeamModal(true);
							}}
							className="btn-primary flex items-center gap-1 text-xs py-1.5 px-2.5 flex-shrink-0"
						>
							<FaPlus className="w-3 h-3" />
							Create New Team
						</button>
					</div>
				</div>

				{/* Stats summary row */}
				<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
					<div className="stat-card">
						<p className="text-xs text-[var(--text-secondary)] mb-1">Total Teams</p>
						<p className="text-2xl font-bold text-[var(--text-primary)]">{totalTeams}</p>
					</div>
					<div className="stat-card">
						<p className="text-xs text-[var(--text-secondary)] mb-1">Active</p>
						<div className="flex items-center gap-2">
							<FaCheckCircle className="w-3 h-3 text-green-400" />
							<p className="text-2xl font-bold text-[var(--text-primary)]">{activeCount}</p>
						</div>
					</div>
					<div className="stat-card">
						<p className="text-xs text-[var(--text-secondary)] mb-1">On Hold</p>
						<div className="flex items-center gap-2">
							<FaClock className="w-3 h-3 text-orange-400" />
							<p className="text-2xl font-bold text-[var(--text-primary)]">{onHoldCount}</p>
						</div>
					</div>
					<div className="stat-card">
						<p className="text-xs text-[var(--text-secondary)] mb-1">Total Members</p>
						<div className="flex items-center gap-2">
							<FaUsers className="w-3 h-3 text-blue-400" />
							<p className="text-2xl font-bold text-[var(--text-primary)]">{totalMembers}</p>
						</div>
					</div>
				</div>

				{/* Main grid: teams + sidebar */}
				<div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
					<div className="xl:col-span-3">
						<div className="mb-4">
							<h2 className="text-lg font-semibold text-[var(--text-primary)]">Development Teams</h2>
							<p className="text-sm text-[var(--text-secondary)] mt-0.5">
								Manage your AI development teams. Each team has a full Agile setup with specialized AI agents.
							</p>
						</div>

						{loading ? (
							<div className="page-panel text-center py-12 text-[var(--text-secondary)] text-sm">
								Loading teams...
							</div>
						) : error ? (
							<div className="page-panel text-center py-12 status-badge error">
								<p>{error}</p>
								<button
									onClick={loadData}
									className="mt-2 text-sm underline text-[var(--accent)]"
								>
									Retry
								</button>
							</div>
						) : filteredTeams.length === 0 ? (
							<div className="page-panel text-center py-12 text-[var(--text-secondary)] text-sm">
								<p>No teams match your filters</p>
								<button
									onClick={() => {
										setSearchQuery('');
										setStatusFilter('all');
									}}
									className="mt-2 text-sm underline text-[var(--accent)]"
								>
									Clear filters
								</button>
							</div>
						) : (
							<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
								{filteredTeams.map((team) => (
									<TeamCard
										key={team.id}
										team={team}
										onViewTeam={() => handleViewTeam(team)}
										menuItems={[
											{ label: 'View', onClick: () => handleViewTeam(team) },
											{
												label: 'Edit',
												onClick: () => {
													setActionError(null);
													setActionMessage(null);
													setEditingTeam(team);
												},
											},
											...(team.status !== 'active'
												? [{ label: 'Activate', onClick: () => handleSetTeamStatus(team, 'active' as Team['status']) }]
												: [{ label: 'Pause', onClick: () => handleSetTeamStatus(team, 'paused' as Team['status']) }]),
											...(team.status !== 'archived'
												? [{ label: 'Archive', onClick: () => handleSetTeamStatus(team, 'archived' as Team['status']) }]
												: []),
											{ label: 'Delete', onClick: () => handleDeleteTeam(team), danger: true },
										]}
									/>
								))}
							</div>
						)}
					</div>

					{/* Right sidebar panels */}
					<div className="xl:col-span-1 space-y-4">
						<div className="page-panel">
							<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
								<FaChartPie className="w-4 h-4 text-[var(--text-tertiary)]" />
								Team Overview
							</h3>
							<InteractiveDonut
								segments={[
									{ label: 'Active', value: activeCount, color: '#4ade80' },
									{ label: 'On Hold', value: onHoldCount, color: '#fbbf24' },
									{ label: 'Archived', value: teams.filter((t) => t.status === 'archived').length, color: '#94a3b8' },
								]}
								size={160}
								strokeWidth={18}
								centerLabel="Teams"
								showLegend={true}
							/>
						</div>

						<div className="page-panel">
							<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3 flex items-center gap-2">
								<FaFileAlt className="w-4 h-4 text-[var(--text-tertiary)]" />
								Teams by Project Type
							</h3>
							<div className="space-y-2.5">
								{[
									{ label: 'Web Application', count: 1, color: 'blue' },
									{ label: 'Mobile Application', count: 1, color: 'purple' },
									{ label: 'Internal Tools', count: 1, color: 'green' },
									{ label: 'Data & Analytics', count: 1, color: 'orange' },
								].map((pt) => (
									<div key={pt.label}>
										<div className="flex items-center justify-between text-xs mb-1">
											<span className="text-[var(--text-secondary)]">{pt.label}</span>
											<span className="text-[var(--text-tertiary)]">{pt.count}</span>
										</div>
										<div className="w-full bg-[var(--bg-tertiary)] rounded-full h-1.5">
											<div
												className="bg-blue-500 h-1.5 rounded-full"
												style={{ width: `${(pt.count / Math.max(totalTeams, 1)) * 100}%` }}
											/>
										</div>
									</div>
								))}
							</div>
						</div>

						<div className="page-panel">
							<h3 className="text-sm font-semibold text-[var(--text-primary)] mb-3">
								Recent Activity
							</h3>
							<div className="space-y-3">
								{activities.slice(0, 5).map((raw) => {
									const act = activityToDisplay(raw);
									return (
										<div key={act.id} className="flex items-start gap-2.5">
											<div className="w-7 h-7 rounded-full bg-blue-500 flex items-center justify-center text-[var(--text-primary)] text-xs font-bold flex-shrink-0">
												{act.letter}
											</div>
											<div className="flex-1 min-w-0">
												<p className="text-xs text-[var(--text-secondary)] leading-snug">{act.description}</p>
												<p className="text-[11px] text-[var(--text-tertiary)] mt-0.5">{act.timestamp}</p>
											</div>
										</div>
									);
								})}
							</div>
							<button className="flex items-center gap-1 text-xs text-[var(--accent)] hover:underline mt-3">
								View All <FaArrowRight className="w-3 h-3" />
							</button>
						</div>
					</div>
				</div>

				{/* New Team Modal */}
				{actionMessage && (
					<div className="fixed bottom-4 right-4 z-40 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-300">
						{actionMessage}
					</div>
				)}

				{showNewTeamModal && (
					<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
						<div className="page-panel w-full max-w-md animate-fade-in">
							<div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
								<h2 className="text-lg font-semibold text-[var(--text-primary)]">Create New Team</h2>
								<button
									onClick={() => {
										setShowNewTeamModal(false);
										setActionError(null);
									}}
									className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
								>
									<FaTimes className="w-5 h-5" />
								</button>
							</div>
							<form onSubmit={handleCreateTeam} className="p-4 space-y-4">
								{error && (
									<div className="status-badge error text-sm">{error}</div>
								)}
								{actionError && (
									<div className="status-badge error text-sm">{actionError}</div>
								)}
								<div>
									<label className="block text-sm text-[var(--text-secondary)] mb-1">Team Name</label>
									<input
										name="teamName"
										type="text"
										required
										placeholder="e.g. Frontend Squad"
										className="input-field w-full"
									/>
								</div>
								<div>
									<label className="block text-sm text-[var(--text-secondary)] mb-1">Description</label>
									<textarea
										name="teamDescription"
										rows={3}
										placeholder="What does this team do?"
										className="input-field w-full resize-none"
									/>
								</div>
								<div>
									<label className="block text-sm text-[var(--text-secondary)] mb-1">Status</label>
									<select name="teamStatus" className="input-field w-full">
										<option value="active">Active</option>
										<option value="paused">Paused</option>
										<option value="archived">Archived</option>
									</select>
								</div>
								<div className="flex justify-end gap-2 pt-2">
									<button
										type="button"
										onClick={() => {
											setShowNewTeamModal(false);
											setActionError(null);
										}}
										className="btn-secondary"
										disabled={creating}
									>
										Cancel
									</button>
									<button type="submit" className="btn-primary" disabled={creating}>
										{creating ? 'Creating...' : 'Create Team'}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}

				{editingTeam && (
					<div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
						<div className="page-panel w-full max-w-md animate-fade-in">
							<div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
								<h2 className="text-lg font-semibold text-[var(--text-primary)]">Edit Team</h2>
								<button
									onClick={() => {
										setEditingTeam(null);
										setActionError(null);
									}}
									className="p-1 rounded hover:bg-[var(--surface-hover)] text-[var(--text-secondary)]"
								>
									<FaTimes className="w-5 h-5" />
								</button>
							</div>
							<form onSubmit={handleUpdateTeam} className="p-4 space-y-4">
								{actionError && (
									<div className="status-badge error text-sm">{actionError}</div>
								)}
								<div>
									<label className="block text-sm text-[var(--text-secondary)] mb-1">Team Name</label>
									<input
										name="teamName"
										type="text"
										required
										defaultValue={editingTeam.name}
										className="input-field w-full"
									/>
								</div>
								<div>
									<label className="block text-sm text-[var(--text-secondary)] mb-1">Description</label>
									<textarea
										name="teamDescription"
										rows={3}
										defaultValue={editingTeam.description || ''}
										className="input-field w-full resize-none"
									/>
								</div>
								<div>
									<label className="block text-sm text-[var(--text-secondary)] mb-1">Status</label>
									<select name="teamStatus" defaultValue={editingTeam.status} className="input-field w-full">
										<option value="active">Active</option>
										<option value="paused">Paused</option>
										<option value="archived">Archived</option>
									</select>
								</div>
								<div className="flex justify-end gap-2 pt-2">
									<button
										type="button"
										onClick={() => {
											setEditingTeam(null);
											setActionError(null);
										}}
										className="btn-secondary"
										disabled={savingTeam}
									>
										Cancel
									</button>
									<button type="submit" className="btn-primary" disabled={savingTeam}>
										{savingTeam ? 'Saving...' : 'Save Team'}
									</button>
								</div>
							</form>
						</div>
					</div>
				)}
			</div>
		</Layout>
	);
};

export default Teams;
