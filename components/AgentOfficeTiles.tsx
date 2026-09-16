import React from 'react';
import { FaComments, FaMicrochip, FaUser } from 'react-icons/fa';
import type { Agent, Member, Task, Team } from '@/types';

type OfficeTeam = Team & {
	members: Member[];
	tasks: Task[];
	description?: string;
};

type AgentWithMember = Agent & {
	member?: Pick<Member, 'id' | 'teamId'>;
};

export type AgentOfficeSelection = {
	teamId: string;
	teamName: string;
	memberId?: string;
	memberName?: string;
	memberRole?: string;
	memberType?: Member['type'];
	agentId?: string;
	agentName?: string;
	agentModel?: string;
	agentStatus?: Agent['status'];
	openChat?: boolean;
};

interface AgentOfficeTilesProps {
	teams: OfficeTeam[];
	agents: AgentWithMember[];
	selectedMemberId?: string | null;
	onSelect?: (selection: AgentOfficeSelection) => void;
}

const BAY_STYLES = [
	{ rail: 'bg-blue-500', tint: 'from-blue-500/18' },
	{ rail: 'bg-emerald-500', tint: 'from-emerald-500/18' },
	{ rail: 'bg-amber-500', tint: 'from-amber-500/18' },
	{ rail: 'bg-purple-500', tint: 'from-purple-500/18' },
	{ rail: 'bg-cyan-500', tint: 'from-cyan-500/18' },
	{ rail: 'bg-rose-500', tint: 'from-rose-500/18' },
];

function statusLabel(status?: Agent['status']) {
	if (status === 'working') return 'Active';
	if (status === 'error') return 'Needs check';
	return 'Idle';
}

export default function AgentOfficeTiles({ teams, agents, selectedMemberId, onSelect }: AgentOfficeTilesProps) {
	const agentsByMember = new Map<string, AgentWithMember>();
	agents.forEach((agent) => agentsByMember.set(agent.memberId, agent));

	return (
		<div className="relative min-h-[620px] overflow-hidden bg-[#101827] p-4">
			<div className="absolute inset-0 bg-[linear-gradient(rgba(148,163,184,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.08)_1px,transparent_1px)] bg-[size:28px_28px]" />
			<div className="relative grid auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
				{teams.map((team, teamIndex) => {
					const style = BAY_STYLES[teamIndex % BAY_STYLES.length];
					const members = team.members || [];
					const openTasks = (team.tasks || []).filter((task) => task.status !== 'done').length;

					return (
						<section
							key={team.id}
							className={`relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br ${style.tint} to-slate-950/92 p-4 shadow-xl`}
						>
							<div className={`absolute left-0 top-0 h-full w-1 ${style.rail}`} />
							<div className="mb-4 flex items-start justify-between gap-3">
								<div className="min-w-0">
									<h3 className="truncate text-lg font-semibold text-white">{team.name}</h3>
									<p className="mt-1 text-xs uppercase tracking-[0.14em] text-slate-400">
										{members.length} desk{members.length === 1 ? '' : 's'} · {openTasks} open
									</p>
								</div>
								<span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-xs text-slate-300">
									Bay {teamIndex + 1}
								</span>
							</div>

							<div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
								{members.map((member) => {
									const agent = agentsByMember.get(member.id);
									const active = agent?.status === 'working';
									const selected = selectedMemberId === member.id;
									const selection: AgentOfficeSelection = {
										teamId: team.id,
										teamName: team.name,
										memberId: member.id,
										memberName: member.name,
										memberRole: member.role,
										memberType: member.type,
										agentId: agent?.id,
										agentName: agent?.name,
										agentModel: agent?.model,
										agentStatus: agent?.status,
									};

									return (
										<button
											key={member.id}
											type="button"
											onClick={() => onSelect?.(selection)}
											className={
												"agent-office-desk relative min-h-[154px] overflow-hidden rounded-lg border p-3 text-left transition-all " +
												(selected
													? "border-blue-300 bg-slate-900 shadow-[0_0_0_1px_rgba(147,197,253,0.7),0_18px_40px_rgba(37,99,235,0.24)]"
													: active
														? "office-active border-emerald-300/70 bg-slate-900/95 shadow-[0_16px_36px_rgba(16,185,129,0.16)]"
														: "border-white/10 bg-slate-900/80 hover:border-white/25")
											}
										>
											<div className="flex items-start justify-between gap-2">
												<div className="min-w-0">
													<p className="truncate text-sm font-semibold text-white">{member.name}</p>
													<p className="mt-0.5 truncate text-[11px] text-slate-400">{member.role}</p>
												</div>
												<span
													className={
														"inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
														(active
															? "bg-emerald-400/15 text-emerald-200"
															: agent?.status === 'error'
																? "bg-red-400/15 text-red-200"
																: "bg-slate-700 text-slate-300")
													}
												>
													<span className={active ? "h-1.5 w-1.5 rounded-full bg-emerald-300 office-status-dot" : "h-1.5 w-1.5 rounded-full bg-slate-400"} />
													{statusLabel(agent?.status)}
												</span>
											</div>

											<div className="mt-4 flex items-end justify-center gap-3">
												<div className="relative flex h-20 w-20 items-center justify-center rounded-md bg-slate-800 shadow-[0_10px_20px_rgba(0,0,0,0.24)]">
													<div className="absolute -top-4 h-11 w-14 rounded-sm border border-slate-600 bg-slate-950">
														<div className={active ? "office-monitor-line" : "mt-2 h-1 w-8 rounded bg-slate-700 mx-auto"} />
														<div className={active ? "office-monitor-line delay" : "mt-2 h-1 w-5 rounded bg-slate-700 mx-auto"} />
													</div>
													<div className="absolute bottom-2 h-1.5 w-14 rounded-full bg-slate-700" />
												</div>

												<div className={active ? "office-avatar-active flex flex-col items-center" : "flex flex-col items-center"}>
													<div
														className={
															"flex h-11 w-11 items-center justify-center rounded-full " +
															(member.type === 'ai' ? "bg-purple-500 text-purple-50" : "bg-blue-500 text-blue-50")
														}
													>
														{member.type === 'ai' ? <FaMicrochip className="h-4 w-4" /> : <FaUser className="h-4 w-4" />}
													</div>
													<div className={member.type === 'ai' ? "mt-1 h-5 w-9 rounded-b-full bg-purple-700" : "mt-1 h-5 w-9 rounded-b-full bg-blue-700"} />
												</div>
											</div>

											<div className="mt-4 flex items-center justify-between gap-2">
												<p className="min-w-0 truncate text-[11px] text-slate-400">
													{agent?.name || (member.type === 'human' ? 'Human teammate' : 'AI agent')}
												</p>
												<span
													role="button"
													tabIndex={0}
													onClick={(event) => {
														event.stopPropagation();
														onSelect?.({ ...selection, openChat: true });
													}}
													onKeyDown={(event) => {
														if (event.key === 'Enter' || event.key === ' ') {
															event.preventDefault();
															event.stopPropagation();
															onSelect?.({ ...selection, openChat: true });
														}
													}}
													className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300 hover:border-white/30 hover:text-white"
												>
													<FaComments className="h-3 w-3" />
													Chat
												</span>
											</div>
										</button>
									);
								})}

								{members.length === 0 && (
									<div className="rounded-lg border border-dashed border-white/10 bg-slate-900/50 p-5 text-center text-sm text-slate-500">
										No desks in this bay yet.
									</div>
								)}
							</div>
						</section>
					);
				})}
			</div>

			<style jsx>{`
				.agent-office-desk {
					transform: translateY(0);
				}
				.agent-office-desk:hover {
					transform: translateY(-2px);
				}
				.office-active {
					animation: officePulse 1.8s ease-in-out infinite;
				}
				.office-avatar-active {
					animation: officeWorkBob 1.05s ease-in-out infinite;
				}
				.office-status-dot {
					animation: officeBlink 1s ease-in-out infinite;
				}
				.office-monitor-line {
					height: 4px;
					width: 34px;
					margin: 9px auto 0;
					border-radius: 999px;
					background: #34d399;
					animation: monitorScan 1.1s ease-in-out infinite;
				}
				.office-monitor-line.delay {
					width: 22px;
					animation-delay: 0.22s;
				}
				@keyframes officePulse {
					0%, 100% { box-shadow: 0 16px 36px rgba(16, 185, 129, 0.14); }
					50% { box-shadow: 0 16px 42px rgba(16, 185, 129, 0.34); }
				}
				@keyframes officeWorkBob {
					0%, 100% { transform: translateY(0); }
					50% { transform: translateY(-4px); }
				}
				@keyframes officeBlink {
					0%, 100% { opacity: 0.35; }
					50% { opacity: 1; }
				}
				@keyframes monitorScan {
					0%, 100% { opacity: 0.35; transform: scaleX(0.65); }
					50% { opacity: 1; transform: scaleX(1); }
				}
			`}</style>
		</div>
	);
}
