import React from 'react';
import AgentSprite from './AgentSprite';
import type { Agent, Member, Task, Team } from '@/types';

type OfficeTeam = Team & { members: Member[]; tasks: Task[] };
type AgentWithMember = Agent & { member?: Pick<Member, 'id' | 'name' | 'role' | 'teamId'> };

const BAY_COLORS = [
  { rail: 'bg-sky-500',   tint: 'from-sky-500/10',   name: 'text-sky-300' },
  { rail: 'bg-emerald-500', tint: 'from-emerald-500/10', name: 'text-emerald-300' },
  { rail: 'bg-amber-500', tint: 'from-amber-500/10',  name: 'text-amber-300' },
  { rail: 'bg-purple-500', tint: 'from-purple-500/10', name: 'text-purple-300' },
  { rail: 'bg-cyan-500',  tint: 'from-cyan-500/10',   name: 'text-cyan-300' },
  { rail: 'bg-rose-500',  tint: 'from-rose-500/10',   name: 'text-rose-300' },
];

interface OfficeFloorProps {
  teams: OfficeTeam[];
  agents: AgentWithMember[];
  selectedMemberId?: string | null;
  onSelect?: (selection: {
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
  }) => void;
}

export default function OfficeFloor({ teams, agents, selectedMemberId, onSelect }: OfficeFloorProps) {
  const agentsByMember = new Map<string, AgentWithMember>();
  agents.forEach((a) => agentsByMember.set(a.memberId, a));

  return (
    <div className="relative min-h-[720px] overflow-hidden rounded-xl border border-white/10 bg-slate-950 p-4">
      <div
        className="absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'linear-gradient(rgba(148,163,184,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(148,163,184,0.07) 1px, transparent 1px)',
          backgroundSize: '28px 28px',
        }}
      />
      <div className="relative grid auto-rows-fr grid-cols-1 gap-4 lg:grid-cols-2 2xl:grid-cols-3">
        {teams.map((team, i) => {
          const color = BAY_COLORS[i % BAY_COLORS.length];
          const members = team.members || [];
          const openTasks = (team.tasks || []).filter((t) => t.status !== 'done').length;
          const workingCount = members.filter((m) => agentsByMember.get(m.id)?.status === 'working').length;

          return (
            <section
              key={team.id}
              className={`relative overflow-hidden rounded-lg border border-white/10 bg-gradient-to-br ${color.tint} to-slate-900/90 p-4 shadow-xl`}
            >
              <div className={`absolute left-0 top-0 h-full w-1 ${color.rail}`} />
              <div className="mb-3 flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className={`truncate text-base font-semibold ${color.name}`}>{team.name}</h3>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wider text-slate-400">
                    {members.length} desk{members.length === 1 ? '' : 's'} &middot; {openTasks} open &middot; {workingCount} active
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-white/10 bg-white/5 px-2 py-0.5 text-[10px] text-slate-300">
                  Bay {i + 1}
                </span>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {members.map((member) => {
                  const linkedAgent = agentsByMember.get(member.id);
                  const task = (team.tasks || []).find((t) => t.agentId === linkedAgent?.id && t.status !== 'done');
                  const isSelected = selectedMemberId === member.id;

                  return (
                    <button
                      key={member.id}
                      type="button"
                      onClick={() =>
                        onSelect?.({
                          teamId: team.id,
                          teamName: team.name,
                          memberId: member.id,
                          memberName: member.name,
                          memberRole: member.role,
                          memberType: member.type,
                          agentId: linkedAgent?.id,
                          agentName: linkedAgent?.name,
                          agentModel: linkedAgent?.model,
                          agentStatus: linkedAgent?.status,
                        })
                      }
                      className={[
                        'text-left rounded-lg border transition-all duration-200',
                        isSelected
                          ? 'border-white/30 bg-white/10 shadow-lg'
                          : 'border-white/5 bg-white/[0.03] hover:border-white/20 hover:bg-white/[0.06]',
                      ].join(' ')}
                    >
                      <AgentSprite agent={{ ...linkedAgent, member: { id: member.id, name: member.name, role: member.role, teamId: member.teamId } } as AgentWithMember} activeTask={task} />
                    </button>
                  );
                })}
                {members.length === 0 && (
                  <p className="col-span-full py-8 text-center text-xs text-slate-500">No desks in this bay.</p>
                )}
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
