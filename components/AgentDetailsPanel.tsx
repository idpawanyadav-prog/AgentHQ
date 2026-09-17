import React from 'react';
import { FaChair, FaClock, FaExclamationTriangle, FaCheckCircle, FaMicrochip, FaUser, FaTasks, FaCodeBranch, FaComment } from 'react-icons/fa';
import type { Agent, Member, Task } from '@/types';

type AgentWithMember = Agent & { member?: Pick<Member, 'id' | 'name' | 'role' | 'teamId'> };

interface AgentDetailsPanelProps {
  agent: AgentWithMember | null;
  tasks: Task[];
  onClose: () => void;
  onChat?: () => void;
}

const STATUS_META: Record<string, { color: string; label: string; bg: string }> = {
  idle:    { color: 'text-slate-300', label: 'Idle', bg: 'bg-slate-500/20' },
  working: { color: 'text-emerald-300', label: 'Working', bg: 'bg-emerald-500/20' },
  bench:   { color: 'text-amber-300', label: 'On Bench', bg: 'bg-amber-500/20' },
  blocked: { color: 'text-red-300', label: 'Blocked', bg: 'bg-red-500/20' },
  error:   { color: 'text-red-300', label: 'Error', bg: 'bg-red-500/20' },
  paused:  { color: 'text-yellow-300', label: 'Paused', bg: 'bg-yellow-500/20' },
};

export default function AgentDetailsPanel({ agent, tasks, onClose, onChat }: AgentDetailsPanelProps) {
  if (!agent) {
    return (
      <div className="flex h-full items-center justify-center rounded-xl border border-white/10 bg-slate-900/80 p-6 text-center">
        <p className="text-sm text-slate-500">Select a desk to view agent details.</p>
      </div>
    );
  }

  const meta = STATUS_META[agent.status] || STATUS_META.idle;
  const agentTasks = tasks.filter((t) => t.agentId === agent.id);
  const activeTask = agentTasks.find((t) => ['in_progress', 'review', 'testing'].includes(t.status));
  const initials = agent.name.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-slate-900/80">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <h3 className="text-sm font-semibold text-white">Agent Details</h3>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white">
          &times;
        </button>
      </div>

      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        <div className="flex items-center gap-3">
          <div className={[
            'flex h-10 w-10 items-center justify-center rounded-full text-sm font-bold',
            agent.status === 'working' ? 'bg-emerald-400/30 text-emerald-200 animate-pulse' :
            agent.status === 'error'   ? 'bg-red-400/30 text-red-200' :
            'bg-slate-400/30 text-slate-300',
          ].join(' ')}>
            {(agent.member?.role === 'AI Agent' ? <FaMicrochip className="h-5 w-5" /> : <FaUser className="h-5 w-5" />)}
          </div>
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-white">{agent.name}</p>
            <p className="text-xs text-slate-400">{agent.member?.role || agent.type}</p>
            <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.bg} ${meta.color}`}>
              {meta.label}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-xs">
          <div className="flex justify-between rounded-md bg-white/5 px-3 py-2">
            <span className="text-slate-400">Model</span>
            <span className="text-slate-200">{agent.model}</span>
          </div>
          {agent.config?.gatewayId && (
            <div className="flex justify-between rounded-md bg-white/5 px-3 py-2">
              <span className="text-slate-400">Gateway</span>
              <span className="text-slate-200">{agent.config.gatewayId}</span>
            </div>
          )}
          <div className="flex justify-between rounded-md bg-white/5 px-3 py-2">
            <span className="text-slate-400">Team</span>
            <span className="text-slate-200">{agent.member?.teamId || '—'}</span>
          </div>
          <div className="flex justify-between rounded-md bg-white/5 px-3 py-2">
            <span className="text-slate-400">Assigned Tasks</span>
            <span className="text-slate-200">{agentTasks.length}</span>
          </div>
        </div>

        {activeTask && (
          <div>
            <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">Current Task</h4>
            <div className="rounded-lg border border-emerald-400/30 bg-emerald-500/10 p-3">
              <p className="text-xs font-medium text-emerald-100">{activeTask.title}</p>
              <p className="mt-1 flex items-center gap-1 text-[10px] uppercase tracking-wide text-emerald-300/80">
                <FaCodeBranch className="h-3 w-3" />
                {activeTask.status.replace(/_/g, ' ')}
              </p>
              {activeTask.branch && (
                <p className="mt-1 text-[10px] text-slate-400">{activeTask.branch}</p>
              )}
            </div>
          </div>
        )}

        <div>
          <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-400">All Tasks ({agentTasks.length})</h4>
          <div className="space-y-1.5">
            {agentTasks.length === 0 && <p className="text-xs text-slate-500">No tasks assigned.</p>}
            {agentTasks.map((task) => (
              <div key={task.id} className="rounded-md border border-white/5 bg-white/[0.02] px-3 py-2">
                <p className="truncate text-xs text-slate-200">{task.title}</p>
                <div className="mt-1 flex items-center gap-2 text-[10px] text-slate-500">
                  <span className="uppercase">{task.status.replace(/_/g, ' ')}</span>
                  {task.storyPoints && <span>&middot; {task.storyPoints} pts</span>}
                </div>
              </div>
            ))}
          </div>
        </div>

        {onChat && agent.config?.gatewayId && (
          <button
            type="button"
            onClick={onChat}
            className="flex w-full items-center justify-center gap-2 rounded-lg border border-white/10 bg-white/5 px-4 py-2 text-xs font-medium text-slate-200 hover:border-white/25 hover:bg-white/10"
          >
            <FaComment className="h-3.5 w-3.5" />
            Open Chat
          </button>
        )}
      </div>
    </div>
  );
}
