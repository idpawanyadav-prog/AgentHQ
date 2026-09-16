import React, { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import AgentOfficeTiles, { type AgentOfficeSelection } from '@/components/AgentOfficeTiles';
import api from '@/lib/api-client';
import type { Agent, Member, Task, Team } from '@/types';
import { FaBuilding, FaChair, FaCheck, FaClock, FaComments, FaMicrochip, FaPaperPlane, FaTasks, FaTimes } from 'react-icons/fa';

type OfficeTeam = Team & {
	members: Member[];
	tasks: Task[];
	description?: string;
};

type AgentWithMember = Agent & {
	member?: Pick<Member, 'id' | 'teamId'>;
};

type ChatMessage = {
	from: 'member' | 'user';
	text: string;
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
	const [chatTarget, setChatTarget] = useState<AgentOfficeSelection | null>(null);
	const [chatDraft, setChatDraft] = useState('');
	const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
	const [selectedTaskId, setSelectedTaskId] = useState('');
	const [actionError, setActionError] = useState('');
	const [actionMessage, setActionMessage] = useState('');
	const [busyAction, setBusyAction] = useState<'chat' | 'assign' | 'activate' | null>(null);
	const [statusFilter, setStatusFilter] = useState<'all' | 'backlog' | 'active' | 'done'>('all');
	const [loading, setLoading] = useState(true);
	const [error, setError] = useState('');

	const refreshOfficeData = useCallback(async () => {
		const [teamData, agentData] = await Promise.all([api.getTeams(), api.getAgents()]);
		setTeams(normalizeTeams(Array.isArray(teamData) ? teamData : []));
		setAgents(Array.isArray(agentData) ? agentData : []);
	}, []);

	useEffect(() => {
		let active = true;
		async function load() {
			setLoading(true);
			setError('');
			try {
				if (!active) return;
				await refreshOfficeData();
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
	}, [refreshOfficeData]);

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
	const chatKey = chatTarget?.memberId || '';
	const activeChatMessages = chatKey ? chatMessages[chatKey] || [] : [];
	const selectedAgent = selection?.agentId ? agents.find((agent) => agent.id === selection.agentId) : null;
	const selectedTeamOpenTasks = useMemo(
		() => selectedTeam ? (selectedTeam.tasks || []).filter((task) => task.status !== 'done' && !task.blocked) : [],
		[selectedTeam],
	);

	useEffect(() => {
		if (!selection?.teamId) {
			setSelectedTaskId('');
			return;
		}
		const currentStillValid = selectedTeamOpenTasks.some((task) => task.id === selectedTaskId);
		if (!currentStillValid) setSelectedTaskId(selectedTeamOpenTasks[0]?.id || '');
	}, [selection?.teamId, selectedTaskId, selectedTeamOpenTasks]);

	const openChat = (target: AgentOfficeSelection) => {
		if (!target.memberId) return;
		setChatTarget(target);
		setChatMessages((previous) => {
			if (previous[target.memberId!]) return previous;
			const intro = target.memberType === 'human'
				? `Hi, I'm ${target.memberName}. I'm sitting in the ${target.teamName} bay.`
				: `Hi, I'm ${target.agentName || target.memberName}. I'm ready in the ${target.teamName} bay.`;
			return {
				...previous,
				[target.memberId!]: [{ from: 'member', text: intro }],
			};
		});
	};

	const handleOfficeSelect = (nextSelection: AgentOfficeSelection) => {
		setSelection(nextSelection);
		if (nextSelection.openChat) openChat(nextSelection);
	};

	const sendChatMessage = () => {
		const text = chatDraft.trim();
		if (!text || !chatTarget?.memberId) return;
		if (!chatTarget.agentId) {
			setActionError('Only AI agents can chat through a gateway. This desk is a human teammate.');
			return;
		}
		const history = activeChatMessages.map((message) => ({
			role: message.from === 'user' ? 'user' as const : 'assistant' as const,
			content: message.text,
		}));
		setChatMessages((previous) => ({
			...previous,
			[chatTarget.memberId!]: [
				...(previous[chatTarget.memberId!] || []),
				{ from: 'user', text },
			],
		}));
		setChatDraft('');
		setActionError('');
		setActionMessage('');
		setBusyAction('chat');
		api.chatAgent(chatTarget.agentId, { message: text, history })
			.then((response) => {
				setChatMessages((previous) => ({
					...previous,
					[chatTarget.memberId!]: [
						...(previous[chatTarget.memberId!] || []),
						{ from: 'member', text: response.reply },
					],
				}));
				setActionMessage('Gateway chat completed.');
				return refreshOfficeData();
			})
			.catch((err) => setActionError(err instanceof Error ? err.message : 'Gateway chat failed'))
			.finally(() => setBusyAction(null));
	};

	const assignSelectedTask = async () => {
		if (!selection?.memberId || !selectedTaskId) return;
		setActionError('');
		setActionMessage('');
		setBusyAction('assign');
		try {
			await api.assignTask(selectedTaskId, selection.memberId, selection.agentId);
			await refreshOfficeData();
			setActionMessage('Task assigned.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Failed to assign task');
		} finally {
			setBusyAction(null);
		}
	};

	const activateSelectedAgent = async () => {
		if (!selection?.agentId || !selectedTaskId) return;
		setActionError('');
		setActionMessage('');
		setBusyAction('activate');
		try {
			await api.assignTask(selectedTaskId, selection.memberId, selection.agentId);
			await api.startAgent(selection.agentId, selectedTaskId);
			await refreshOfficeData();
			setActionMessage('Agent activated.');
		} catch (err) {
			setActionError(err instanceof Error ? err.message : 'Failed to activate agent');
		} finally {
			setBusyAction(null);
		}
	};

	return (
		<Layout activeNav="agent-office">
			<div className="space-y-6 transition-colors duration-200">
				<div>
					<h1 className="text-2xl font-bold text-[var(--text-primary)]">Agent Office</h1>
					<p className="mt-1 text-sm text-[var(--text-secondary)]">
						Tile office generated from your actual teams. Each team becomes one bay; each assigned member becomes one desk.
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
										<h2 className="text-lg font-semibold text-[var(--text-primary)]">Team Tile Office</h2>
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
								<AgentOfficeTiles
									teams={teams}
									agents={agents}
									selectedMemberId={selection?.memberId}
									onSelect={handleOfficeSelect}
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
												{selection.memberId && (
													<div className="space-y-2 border-t border-[#d8d0c0] pt-2">
														<label className="block text-[10px] font-bold uppercase tracking-[0.14em] text-[#77736b]">
															Open task
														</label>
														<select
															value={selectedTaskId}
															onChange={(event) => setSelectedTaskId(event.target.value)}
															className="w-full rounded-md border border-[#d8d0c0] bg-white px-2 py-2 text-xs outline-none focus:border-[#171514]"
															disabled={selectedTeamOpenTasks.length === 0}
														>
															{selectedTeamOpenTasks.length === 0 ? (
																<option value="">No open tasks in this team</option>
															) : (
																selectedTeamOpenTasks.map((task) => (
																	<option key={task.id} value={task.id}>
																		{task.title} ({task.status.replace(/_/g, ' ')})
																	</option>
																))
															)}
														</select>
														<div className="grid grid-cols-2 gap-2">
															<button
																type="button"
																onClick={assignSelectedTask}
																disabled={!selectedTaskId || busyAction !== null}
																className="rounded-md border border-[#171514] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#171514] disabled:cursor-not-allowed disabled:opacity-45"
															>
																{busyAction === 'assign' ? 'Assigning...' : 'Assign'}
															</button>
															<button
																type="button"
																onClick={activateSelectedAgent}
																disabled={!selectedTaskId || !selection.agentId || selectedAgent?.status === 'working' || busyAction !== null}
																className="rounded-md bg-[#171514] px-3 py-2 text-xs font-semibold uppercase tracking-wide text-[#f4efe3] disabled:cursor-not-allowed disabled:opacity-45"
															>
																{busyAction === 'activate' ? 'Starting...' : 'Activate'}
															</button>
														</div>
														{!selection.agentId && <p className="text-xs text-[#77736b]">Assign works for this human desk. Activation requires an AI agent.</p>}
														{selection.agentId && selectedAgent?.status === 'working' && <p className="text-xs text-[#77736b]">This agent is already active.</p>}
													</div>
												)}
											</div>
										) : (
											<p className="text-sm text-[#77736b]">Click a bay or desk in the office.</p>
										)}
									</div>

									{(actionError || actionMessage) && (
										<div className={"mt-3 rounded-md border px-3 py-2 text-xs " + (actionError ? "border-red-300 bg-red-50 text-red-700" : "border-emerald-300 bg-emerald-50 text-emerald-700")}>
											{actionError || actionMessage}
										</div>
									)}

									<div className="mt-4 rounded-md border border-[#d8d0c0] bg-white/70 p-3">
										<div className="mb-2 flex items-center justify-between gap-2">
											<div className="flex items-center gap-2">
												<FaComments className="h-3.5 w-3.5 text-[#77736b]" />
												<h4 className="text-xs font-bold uppercase tracking-[0.14em] text-[#77736b]">Chat</h4>
											</div>
											{chatTarget && (
												<button
													type="button"
													onClick={() => setChatTarget(null)}
													className="rounded-full p-1 text-[#77736b] hover:bg-[#f4efe3] hover:text-[#171514]"
													title="Close chat"
												>
													<FaTimes className="h-3 w-3" />
												</button>
											)}
										</div>
										{chatTarget ? (
											<div className="space-y-3">
												<div>
													<p className="text-base font-semibold">{chatTarget.memberName || chatTarget.agentName}</p>
													<p className="text-xs text-[#77736b]">{chatTarget.memberRole || chatTarget.agentModel || chatTarget.teamName}</p>
												</div>
												<div className="flex max-h-[220px] flex-col gap-2 overflow-y-auto rounded-md border border-[#d8d0c0] bg-[#f4efe3] p-2">
													{activeChatMessages.map((message, index) => (
														<div
															key={`${chatKey}-${index}`}
															className={
																"max-w-[86%] rounded-md px-2.5 py-2 text-xs leading-relaxed " +
																(message.from === 'user'
																	? "self-end bg-[#171514] text-[#f4efe3]"
																	: "self-start border border-[#d8d0c0] bg-white text-[#171514]")
															}
														>
															{message.text}
														</div>
													))}
												</div>
												<form
													className="flex gap-2"
													onSubmit={(event) => {
														event.preventDefault();
														sendChatMessage();
													}}
												>
													<input
														value={chatDraft}
														onChange={(event) => setChatDraft(event.target.value)}
														placeholder="Message this member..."
														className="min-w-0 flex-1 rounded-md border border-[#d8d0c0] bg-white px-3 py-2 text-xs outline-none focus:border-[#171514]"
													/>
													<button
														type="submit"
														disabled={busyAction !== null}
														className="inline-flex items-center justify-center rounded-md bg-[#171514] px-3 text-[#f4efe3] hover:bg-black disabled:cursor-not-allowed disabled:opacity-45"
														title="Send"
													>
														{busyAction === 'chat' ? <span className="text-[10px] font-bold">...</span> : <FaPaperPlane className="h-3 w-3" />}
													</button>
												</form>
											</div>
										) : (
											<p className="text-sm text-[#77736b]">Click a name label above any desk to chat.</p>
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
