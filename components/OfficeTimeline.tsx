import React from 'react';
import {
  FaCheck,
  FaCodeBranch,
  FaCog,
  FaComment,
  FaExclamationTriangle,
  FaFlask,
  FaPause,
  FaPlay,
  FaRocket,
  FaSyncAlt,
  FaTasks,
  FaUserPlus,
  FaClock,
  FaBug,
  FaSearch,
  FaEye,
} from 'react-icons/fa';
import type { Activity } from '@/types';

interface OfficeTimelineProps {
  activities: Activity[];
  pollIntervalMs?: number;
  maxItems?: number;
}

const TYPE_META: Record<string, { icon: React.ElementType; color: string; label: string }> = {
  task_assigned:        { icon: FaTasks,         color: 'text-blue-300',     label: 'Task Assigned' },
  task_moved:           { icon: FaTasks,         color: 'text-slate-300',    label: 'Task Moved' },
  commit:               { icon: FaCodeBranch,    color: 'text-purple-300',   label: 'Commit' },
  pr_opened:            { icon: FaCodeBranch,    color: 'text-blue-300',     label: 'PR Opened' },
  pr_merged:            { icon: FaCodeBranch,    color: 'text-emerald-300',  label: 'PR Merged' },
  pr_closed:            { icon: FaCodeBranch,    color: 'text-red-300',      label: 'PR Closed' },
  ci_passed:            { icon: FaCheck,         color: 'text-emerald-300',  label: 'CI Passed' },
  ci_failed:            { icon: FaExclamationTriangle, color: 'text-red-300', label: 'CI Failed' },
  agent_started:        { icon: FaPlay,          color: 'text-emerald-300',  label: 'Agent Started' },
  agent_completed:      { icon: FaCheck,         color: 'text-emerald-300',  label: 'Agent Completed' },
  agent_error:          { icon: FaBug,           color: 'text-red-300',      label: 'Agent Error' },
  agent_benched:        { icon: FaUserPlus,      color: 'text-amber-300',    label: 'Agent Benched' },
  agent_joined:         { icon: FaUserPlus,      color: 'text-blue-300',     label: 'Agent Joined' },
  team_created:         { icon: FaUserPlus,      color: 'text-blue-300',     label: 'Team Created' },
  member_added:         { icon: FaUserPlus,      color: 'text-blue-300',     label: 'Member Added' },
  milestone_completed:  { icon: FaRocket,        color: 'text-emerald-300',  label: 'Milestone Completed' },
};

function formatTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60_000);
  const diffHr = Math.floor(diffMin / 60);
  const diffDay = Math.floor(diffHr / 24);

  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffHr < 24) return `${diffHr}h ago`;
  if (diffDay < 7) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

export default function OfficeTimeline({ activities, maxItems = 30 }: OfficeTimelineProps) {
  const visible = activities.slice(0, maxItems);

  return (
    <div className="rounded-xl border border-white/10 bg-slate-950/80">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <FaClock className="h-3.5 w-3.5 text-slate-400" />
          <h3 className="text-sm font-semibold text-white">Timeline</h3>
          <span className="rounded-full bg-white/5 px-2 py-0.5 text-[10px] text-slate-400">
            {activities.length} events
          </span>
        </div>
        <span className="flex items-center gap-1 text-[10px] text-slate-500">
          <FaSyncAlt className="h-3 w-3" />
          live
        </span>
      </div>

      <div className="max-h-[480px] overflow-y-auto p-4">
        {visible.length === 0 ? (
          <p className="py-8 text-center text-xs text-slate-500">No activity yet.</p>
        ) : (
          <ol className="relative space-y-3">
            <span className="absolute left-3 top-2 bottom-2 w-px bg-white/10" aria-hidden />
            {visible.map((activity) => {
              const meta = TYPE_META[activity.type] || {
                icon: FaComment,
                color: 'text-slate-400',
                label: activity.type,
              };
              const Icon = meta.icon;
              return (
                <li key={activity.id} className="relative flex items-start gap-3 pl-1">
                  <div className={`z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 ${meta.color}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className={`text-[10px] font-semibold uppercase tracking-wider ${meta.color}`}>
                        {meta.label}
                      </span>
                      <span className="text-[10px] text-slate-500">{formatTime(activity.createdAt)}</span>
                    </div>
                    <p className="text-xs text-slate-300">{activity.description}</p>
                    {activity.member && (
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                        <FaUserPlus className="h-2.5 w-2.5" />
                        {activity.member.name}
                      </p>
                    )}
                    {activity.task && (
                      <p className="mt-0.5 flex items-center gap-1 text-[10px] text-slate-500">
                        <FaTasks className="h-2.5 w-2.5" />
                        {activity.task.title}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </div>
    </div>
  );
}
