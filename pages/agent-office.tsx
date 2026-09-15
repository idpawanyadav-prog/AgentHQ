import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import AgentOfficeScene, { type AgentOfficeSelection } from '@/components/AgentOfficeScene';
import api from '@/lib/api-client';
import type { Agent, Member, Task, Team } from '@/types';
import { FaBuilding, FaChair, FaCheck, FaClock, FaMicrochip, FaTasks } from 'react-icons/fa';

type OfficeTeam = Team & {
	members: Member[];
	tasks: Task[];
	description?: string;
};

type AgentWithMember = Agent & {
	member?: Pick<Member, 'id' | 'teamId'>;
};

function normalizeTeams(teamData: OfficeTeam[]) {
	const byKey = new Map<string, OfficeTeam>();
	teamData.forEach((team) => {
		const key = team.id === 'on-bench' || team.name.toLowerCase() === 'on bench' ? 'on-bench' : team.id;
		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, team);
			return;
		}
		byKey.set(key, {
			...existing,
			id: key === 'on-bench' ? 'on-bench' : existing.id,
			name: key === 'on-bench' ? 'On Bench' : existing.name,
			members: [...(existing.members || []), ...(team.members || [])],
			tasks: [...(existing.tasks || []), ...(team.tasks || [])],
		});
	});
	return Array.from(byKey.values());
}

export default function AgentOfficePage() {
	const [teams, setTeams] = useState<OfficeTeam[]>([]);
	const [agents, setAgents] = useState<AgentWithMember[]>([]);
	const [selection, setSelection] = useState<AgentOfficeSelection | null>(null);
	const [statusFilter, setStatusFilter] = useState<'all' | 'backlog' | 'active' | 'done'>('all');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	useEffect(() => {
		let active = true;
		async function load() {
			setLoading(true);
			setError('');
			try {
				const [teamData, agentData] = await Promise.all([api.getTeams(), api.getAgents()]);
				if (!active) return;
				setTeams(normalizeTeams(Array.isArray(teamData) ? teamData : []));
				setAgents(Array.isArray(agentData) ? agentData : []);
			} catch (err) {
				if (active) setError(err instanceof Error ? err.message : 'Failed to load Agent Office');
			} finally {
				if (active) setLoading(false);
			}
		}
		load();
		return () => {
			active = false;
		};
	}, []);

	const totalMembers = teams.reduce((sum, team) => sum + (team.members?.length || 0), 0);
	const allTasks = teams.flatMap((team) => (team.tasks || []).map((task) => ({ ...task, teamName: team.name })));
	const openTasks = allTasks.filter((task) => task.status !== 'done').length;
	const doneTasks = allTasks.filter((task) => task.status === 'done').length;
	const activeTasks = allTasks.filter((task) => ['in_progress', 'review', 'testing', 'blocked'].includes(task.status)).length;
	const backlogTasks = allTasks.filter((task) => task.status === 'backlog' || task.status === 'ready').length;
	const workingAgents = agents.filter((agent) => agent.status === 'working').length;
	const visibleTasks = allTasks.filter((task) => {
		if (statusFilter === 'done') return task.status === 'done';
		if (statusFilter === 'active') return ['in_progress', 'review', 'testing', 'blocked'].includes(task.status);
		if (statusFilter === 'backlog') return task.status === 'backlog' || task.status === 'ready';
		return true;
	});

	const selectedTeam = selection ? teams.find((team) => team.id === selection.teamId) : null;

	return (
		<Layout activeNav="agent-office">
			<div className="space-y-6 transition-colors duration-200">
				<div>
					<h1 className="text-2xl font-bold text-[var(--text-primary)]">Agent Office</h1>
					<p className="mt-1 text-sm text-[var(--text-secondary)]">
						3D/isometric office generated from your actual teams. Each team becomes one bay; each assigned member becomes one desk.
					</p>
				</div>

				{error && <div className="status-badge error text-sm">{error}</div>}

				{loading ? (
					<div className="page-panel py-12 text-center text-sm text-[var(--text-secondary)]">Loading Agent Office...</div>
				) : teams.length === 0 ? (
					<div className="page-panel py-12 text-center text-sm text-[var(--text-secondary)]">
						No teams found. Create a team and this office will build itself.
					</div>
				) : (
					<>
						<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
							{[
								{ label: 'Office Bays', value: teams.length, icon: FaBuilding, bg: 'bg-blue-400/10', color: 'text-blue-300' },
								{ label: 'Desks', value: totalMembers, icon: FaChair, bg: 'bg-purple-400/10', color: 'text-purple-300' },
								{ label: 'Working Agents', value: workingAgents, icon: FaMicrochip, bg: 'bg-green-400/10', color: 'text-green-300' },
								{ label: 'Open Tasks', value: openTasks, icon: FaTasks, bg: 'bg-amber-400/10', color: 'text-amber-300' },
							].map((stat) => {
								const Icon = stat.icon;
								return (
									<div key={stat.label} className="stat-card">
										<div className="flex items-start justify-between gap-3">
											<div>
												<p className="text-xs text-[var(--text-secondary)]">{stat.label}</p>
												<p className="mt-1 text-2xl font-bold text-[var(--text-primary)]">{stat.value}</p>
											</div>
											<div className={`rounded-lg p-2 ${stat.bg} ${stat.color}`}>
												<Icon className="h-4 w-4" />
											</div>
										</div>
									</div>
								);
							})}
						</div>

						<div className="overflow-hidden rounded-lg border border-[var(--border-default)] bg-[#0b1020]">
							<div className="border-b border-[var(--border-default)] px-4 py-3">
								<div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
									<div>
										<h2 className="text-lg font-semibold text-[var(--text-primary)]">3D Isometric Office Floor</h2>
										<p className="mt-1 text-sm text-[var(--text-secondary)]">
											{teams.length} bay{teams.length === 1 ? '' : 's'} rendered dynamically from your teams, including On Bench.
										</p>
									</div>
									<span className="rounded-full bg-blue-400/10 px-3 py-1 text-xs text-blue-300">
										Live office scene
									</span>
								</div>
							</div>
							<div className="grid grid-cols-1 xl:grid-cols-[1fr_360px]">
								<AgentOfficeScene
									teams={teams}
									agents={agents}
									selectedMemberId={selection?.memberId}
									onSelect={setSelection}
								/>
								<aside className="border-t border-[var(--border-default)] bg-[#f4efe3] p-4 text-[#171514] xl:border-l xl:border-t-0">
									<div className="mb-3 border-b border-[#171514] pb-2">
										<div className="flex items-center justify-between">
											<h3 className="font-serif text-lg tracking-wide">TASK STATUS</h3>
											<span className="text-[10px] font-bold uppercase tracking-[0.16em] text-[#77736b]">Whole Office</span>
										</div>
										<p className="mt-1 text-xs text-[#77736b]">{teams.length} bays · {totalMembers} desks · {workingAgents} working</p>
									</div>

									<div className="mb-3 flex flex-wrap gap-1.5">
										{[
											{ id: 'all' as const, label: 'All', count: allTasks.length },
											{ id: 'backlog' as const, label: 'Backlog', count: backlogTasks },
											{ id: 'active' as const, label: 'Active', count: activeTasks },
											{ id: 'done' as const, label: 'Done', count: doneTasks },
										].map((chip) => (
											<button
												key={chip.id}
												type="button"
												onClick={() => setStatusFilter(chip.id)}
												className={
													"rounded-full border px-2.5 py-1 text-xs font-medium transition-colors " +
													(statusFilter === chip.id
														? "border-[#171514] bg-[#171514] text-[#f4efe3]"
														: "border-[#d8d0c0] text-[#5f5a51] hover:border-[#171514]")
												}
											>
												{chip.label} <b>{chip.count}</b>
											</button>
										))}
									</div>

									<div className="mb-4 max-h-[260px] space-y-2 overflow-y-auto pr-1">
										{visibleTasks.length === 0 && <p className="py-5 text-sm italic text-[#77736b]">Nothing here right now.</p>}
										{visibleTasks.slice(0, 18).map((task) => (
											<div key={task.id} className="rounded-md border border-[#d8d0c0] bg-white/70 p-2">
												<div className="flex items-start gap-2">
													<span className="mt-0.5 rounded border border-[#171514] px-1.5 py-0.5 text-[10px] font-bold uppercase">
														{task.status === 'done' ? <FaCheck className="h-3 w-3" /> : task.status === 'in_progress' ? <FaClock className="h-3 w-3" /> : 'NEXT'}
													</span>
													<div className="min-w-0">
														<p className="line-clamp-2 text-xs font-semibold">{task.title}</p>
														<p className="mt-0.5 text-[10px] uppercase tracking-wide text-[#77736b]">{task.teamName} · {task.status.replace(/_/g, ' ')}</p>
													</div>
												</div>
											</div>
										))}
									</div>

									<div className="rounded-md border border-[#d8d0c0] bg-white/70 p-3">
										<h4 className="mb-2 text-xs font-bold uppercase tracking-[0.14em] text-[#77736b]">Selected</h4>
										{selection ? (
											<div className="space-y-2">
												<div>
													<p className="text-base font-semibold">{selection.memberName || selection.teamName}</p>
													<p className="text-xs text-[#77736b]">{selection.memberRole || selectedTeam?.description || 'Office bay'}</p>
												</div>
												{selection.agentId && (
													<div className="grid grid-cols-2 gap-2 text-xs">
														<div className="rounded bg-[#f4efe3] p-2">
															<p className="text-[#77736b]">Agent</p>
															<p className="font-semibold">{selection.agentName}</p>
														</div>
														<div className="rounded bg-[#f4efe3] p-2">
															<p className="text-[#77736b]">Status</p>
															<p className="font-semibold">{selection.agentStatus}</p>
														</div>
													</div>
												)}
												<p className="text-xs text-[#77736b]">Bay: {selection.teamName}</p>
											</div>
										) : (
											<p className="text-sm text-[#77736b]">Click a bay or desk in the office.</p>
										)}
									</div>
								</aside>
							</div>
						</div>

						<div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
							{teams.map((team) => {
								const members = team.members || [];
								const open = (team.tasks || []).filter((task) => task.status !== 'done').length;
								return (
									<div key={team.id} className="rounded-lg border border-[var(--border-default)] bg-slate-800/30 p-4">
										<div className="flex items-start justify-between gap-3">
											<div className="min-w-0">
												<h3 className="truncate text-sm font-semibold text-[var(--text-primary)]">{team.name}</h3>
												<p className="mt-1 text-xs text-[var(--text-secondary)]">{members.length} desk{members.length === 1 ? '' : 's'} in this bay</p>
											</div>
											<span className="rounded-full bg-slate-900 px-2 py-0.5 text-xs text-slate-400">{open} open</span>
										</div>
										<div className="mt-3 flex flex-wrap gap-2">
											{members.slice(0, 8).map((member) => (
												<span key={member.id} className="rounded-full bg-slate-950/60 px-2 py-1 text-[11px] text-slate-300">
													{member.name}
												</span>
											))}
											{members.length === 0 && <span className="text-xs text-slate-500">No desks yet</span>}
										</div>
									</div>
								);
							})}
						</div>
					</>
				)}
			</div>
		</Layout>
	);
}
