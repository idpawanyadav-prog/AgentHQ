import React from 'react';
import { FaChair, FaClock, FaExclamationTriangle, FaCheckCircle, FaBug, FaPauseCircle, FaPlayCircle } from 'react-icons/fa';
import type { Agent, Member, Task } from '@/types';

type AgentWithMember = Agent & { member?: Pick<Member, 'id' | 'name' | 'role' | 'teamId'> };

interface AgentSpriteProps {
  agent: AgentWithMember;
  activeTask?: Task;
}

const STATUS_STYLES: Record<string, { bg: string; border: string; label: string; icon: React.ElementType }> = {
  idle:     { bg: 'bg-slate-400/20', border: 'border-slate-400/60', label: 'Idle', icon: FaChair },
  working:  { bg: 'bg-emerald-400/15', border: 'border-emerald-400/70', label: 'Working', icon: FaPlayCircle },
  bench:    { bg: 'bg-amber-400/15', border: 'border-amber-400/70', label: 'Bench', icon: FaClock },
  blocked:  { bg: 'bg-red-400/15', border: 'border-red-400/70', label: 'Blocked', icon: FaExclamationTriangle },
  error:    { bg: 'bg-red-400/20', border: 'border-red-400/80', label: 'Error', icon: FaBug },
  paused:   { bg: 'bg-yellow-400/15', border: 'border-yellow-400/70', label: 'Paused', icon: FaPauseCircle },
  done:     { bg: 'bg-emerald-400/20', border: 'border-emerald-400/80', label: 'Done', icon: FaCheckCircle },
};

export default function AgentSprite({ agent, activeTask }: AgentSpriteProps) {
  const rawStatus = agent.status;
  const statusKey: string = rawStatus === 'working' ? 'working'
    : rawStatus === 'bench' ? 'bench'
    : rawStatus === 'error' ? 'error'
    : rawStatus === 'paused' ? 'paused'
    : activeTask?.status === 'blocked' || activeTask?.blocked ? 'blocked'
    : rawStatus;
  const style = STATUS_STYLES[statusKey] || STATUS_STYLES.idle;
  const StatusIcon = style.icon;
  const initials = (agent.name || '?').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const taskSlug = activeTask ? activeTask.title.replace(/[^a-zA-Z0-9]+/g, '-').slice(0, 24) : '';

  return (
    <div
      className={[
        'relative flex flex-col items-center gap-1.5 rounded-xl border p-3 transition-all duration-500',
        style.bg,
        style.border,
      ].join(' ')}
    >
      <div className="flex items-center gap-2">
        <div className={[
          'flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold',
          statusKey === 'working' ? 'bg-emerald-400/30 text-emerald-200 animate-pulse' :
          statusKey === 'blocked' ? 'bg-red-400/30 text-red-200' :
          statusKey === 'error'   ? 'bg-red-500/30 text-red-200' :
          statusKey === 'paused'  ? 'bg-yellow-400/30 text-yellow-200' :
          statusKey === 'bench'   ? 'bg-amber-400/30 text-amber-200' :
                                     'bg-slate-400/30 text-slate-300',
        ].join(' ')}>
          {initials}
        </div>
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-[var(--text-primary)]">
            {agent.name}
          </p>
          <p className="flex items-center gap-1 text-[10px] text-[var(--text-secondary)]">
            <StatusIcon className="h-2.5 w-2.5" />
            {style.label}
          </p>
        </div>
      </div>

      {activeTask && (
        <div className="w-full rounded-md border border-white/5 bg-black/20 px-2 py-1">
          <p className="truncate text-[10px] text-slate-300" title={activeTask.title}>
            {taskSlug}
          </p>
          <p className="text-[9px] uppercase tracking-wider text-slate-500">
            {activeTask.status.replace(/_/g, ' ')}
          </p>
        </div>
      )}

      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-slate-500/60" />
        <span className="text-[9px] text-slate-500">
          {agent.member?.role || agent.type}
        </span>
      </div>
    </div>
  );
}
