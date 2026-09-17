import React from 'react';
import { FaCheck, FaClock, FaExclamationTriangle, FaPlay, FaPause, FaTimes, FaSpinner } from 'react-icons/fa';
import type { Task } from '@/types';

type ViewMode = 'floor' | 'kanban' | 'list' | 'timeline';

const COLUMNS: { key: string; label: string; statuses: Task['status'][]; color: string; icon: React.ElementType }[] = [
  { key: 'backlog',   label: 'Backlog',   statuses: ['backlog', 'ready'], color: 'text-slate-300', icon: FaClock },
  { key: 'progress',  label: 'In Progress', statuses: ['in_progress'], color: 'text-blue-300', icon: FaPlay },
  { key: 'review',    label: 'Review',    statuses: ['review'], color: 'text-purple-300', icon: FaSpinner },
  { key: 'testing',   label: 'Testing',   statuses: ['testing'], color: 'text-amber-300', icon: FaSpinner },
  { key: 'blocked',   label: 'Blocked',   statuses: ['blocked'], color: 'text-red-300', icon: FaExclamationTriangle },
  { key: 'paused',    label: 'Paused',    statuses: ['paused' as Task['status']], color: 'text-yellow-300', icon: FaPause },
  { key: 'done',      label: 'Done',      statuses: ['done'], color: 'text-emerald-300', icon: FaCheck },
];

interface OfficeKanbanProps {
  tasks: Task[];
  viewMode: ViewMode;
  onTaskClick?: (task: Task) => void;
}

const PRIORITY_INDICATOR: Record<string, string> = {
  critical: 'bg-red-500',
  high: 'bg-orange-400',
  medium: 'bg-yellow-400',
  low: 'bg-slate-500',
};

export default function OfficeKanban({ tasks, viewMode, onTaskClick }: OfficeKanbanProps) {
  if (viewMode === 'list') {
    return <ListView tasks={tasks} onTaskClick={onTaskClick} />;
  }

  return (
    <div className="overflow-x-auto rounded-xl border border-white/10 bg-slate-950/80">
      <div className="flex min-w-[900px] gap-3 p-4">
        {COLUMNS.map((col) => {
          const columnTasks = tasks.filter((t) => col.statuses.includes(t.status));
          const Icon = col.icon;
          return (
            <div key={col.key} className="flex w-44 flex-col gap-2">
              <div className="flex items-center gap-2 border-b border-white/10 pb-2">
                <Icon className={`h-3.5 w-3.5 ${col.color}`} />
                <span className={`text-xs font-semibold uppercase tracking-wider ${col.color}`}>{col.label}</span>
                <span className="ml-auto rounded-full bg-white/5 px-1.5 py-0.5 text-[10px] text-slate-400">
                  {columnTasks.length}
                </span>
              </div>
              <div className="flex flex-col gap-2">
                {columnTasks.map((task) => (
                  <button
                    key={task.id}
                    type="button"
                    onClick={() => onTaskClick?.(task)}
                    className="rounded-lg border border-white/5 bg-slate-900/80 p-2.5 text-left hover:border-white/20 hover:bg-slate-800/80 transition-colors"
                  >
                    <div className="flex items-start gap-2">
                      <span className={`mt-1 h-1.5 w-1.5 shrink-0 rounded-full ${PRIORITY_INDICATOR[task.priority] || 'bg-slate-500'}`} />
                      <p className="min-w-0 text-xs font-medium text-slate-200 line-clamp-2">{task.title}</p>
                    </div>
                    {task.storyPoints && (
                      <p className="mt-1.5 text-[10px] text-slate-500">{task.storyPoints} pts</p>
                    )}
                    {task.blocked && task.blockedReason && (
                      <p className="mt-1 truncate text-[10px] text-red-400" title={task.blockedReason}>
                        {task.blockedReason}
                      </p>
                    )}
                  </button>
                ))}
                {columnTasks.length === 0 && (
                  <p className="py-4 text-center text-[11px] text-slate-600">Empty</p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ListView({ tasks, onTaskClick }: { tasks: Task[]; onTaskClick?: (task: Task) => void }) {
  return (
    <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-950/80">
      <table className="w-full text-left text-xs">
        <thead>
          <tr className="border-b border-white/10 text-slate-400">
            <th className="px-3 py-2 font-medium">Task</th>
            <th className="px-3 py-2 font-medium">Status</th>
            <th className="px-3 py-2 font-medium">Priority</th>
            <th className="px-3 py-2 font-medium">Points</th>
            <th className="px-3 py-2 font-medium">Blocker</th>
          </tr>
        </thead>
        <tbody>
          {tasks.map((task) => (
            <tr key={task.id} onClick={() => onTaskClick?.(task)} className="border-b border-white/5 hover:bg-white/5 cursor-pointer">
              <td className="px-3 py-2 text-slate-200">{task.title}</td>
              <td className="px-3 py-2 text-slate-400 capitalize">{task.status.replace(/_/g, ' ')}</td>
              <td className="px-3 py-2 text-slate-400 capitalize">{task.priority}</td>
              <td className="px-3 py-2 text-slate-400">{task.storyPoints ?? '—'}</td>
              <td className="px-3 py-2 text-red-300">{task.blocked ? task.blockedReason || 'Yes' : 'No'}</td>
            </tr>
          ))}
          {tasks.length === 0 && (
            <tr>
              <td colSpan={5} className="px-3 py-8 text-center text-slate-500">No tasks found.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
