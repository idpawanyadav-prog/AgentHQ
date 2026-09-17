import React, { useEffect, useState } from 'react';
import { FaMemory, FaDatabase, FaCheck, FaBook, FaRandom, FaTasks } from 'react-icons/fa';

type DecisionRecord = {
  id: string; title: string; decision: string; rationale?: string; alternatives?: string;
  status: string; createdAt: string;
};
type ExecutionCheckpoint = {
  id: string; phase: string; changedFiles?: string; modelSummary?: string; createdAt: string;
};
type HandoffRecord = {
  id: string; type: string; summary: string; completedWork?: string; remainingWork?: string;
  nextActions?: string; createdAt: string;
};
type ProjectMemory = {
  id: string; projectId: string; mission?: string | null; productSummary?: string | null;
  architecture?: string | null; techStack?: string | null; conventions?: string | null;
  currentPhase?: string | null; currentGoal?: string | null; completedWork?: string | null;
  keyDecisions?: string | null; knownRisks?: string | null; blockers?: string | null;
  nextActions?: string | null; openQuestions?: string | null; testStrategy?: string | null;
  releaseNotes?: string | null; version: number; updatedAt: string;
};
type TaskMemory = {
  id: string; taskId: string; projectId: string; objective?: string | null;
  context?: string | null; investigation?: string | null; implementation?: string | null;
  filesTouched?: string | null; commandsRun?: string | null; validation?: string | null;
  decisions?: string | null; blockers?: string | null; remainingWork?: string | null;
  nextAction?: string | null; version: number; updatedAt: string;
};

type MemoryTab = 'project' | 'task' | 'decisions' | 'checkpoints' | 'handoffs';

interface MemoryPanelProps {
  projectId?: string;
  taskId?: string;
  onClose: () => void;
}

type MemoryState = {
  projectMemory?: ProjectMemory | null;
  taskMemory?: TaskMemory | null;
  decisions: DecisionRecord[];
  checkpoints: ExecutionCheckpoint[];
  handoffs: HandoffRecord[];
};

export default function MemoryPanel({ projectId, taskId, onClose }: MemoryPanelProps) {
  const [tab, setTab] = useState<MemoryTab>('project');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [memory, setMemory] = useState<MemoryState>({ decisions: [], checkpoints: [], handoffs: [] });

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    setError('');

    async function loadMemory() {
      const endpoints: Record<MemoryTab, string | null> = {
        project: projectId ? `/api/projects/${projectId}/memory` : null,
        task:    taskId    ? `/api/tasks/${taskId}/memory` : null,
        decisions: projectId ? `/api/projects/${projectId}/decisions` : null,
        checkpoints: taskId ? `/api/tasks/${taskId}/checkpoints` : null,
        handoffs: taskId ? `/api/tasks/${taskId}/handoffs` : null,
      };

      const next = endpoints[tab];
      if (!next) { setLoading(false); return; }

      try {
        const res = await fetch(next);
        if (!res.ok) throw new Error(`Failed to load ${tab}`);
        const data = await res.json();
        if (cancelled) return;
        setMemory((prev) => ({ ...prev, [tab]: data }));
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Load failed');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadMemory();
    return () => { cancelled = true; };
  }, [tab, projectId, taskId]);

  const renderProject = () => {
    const pm = memory.projectMemory as ProjectMemory | undefined;
    if (!pm) return <EmptyState label="No project memory yet." />;
    const rows = [
      ['Mission', pm.mission],
      ['Product Summary', pm.productSummary],
      ['Architecture', pm.architecture],
      ['Tech Stack', pm.techStack],
      ['Conventions', pm.conventions],
      ['Current Phase', pm.currentPhase],
      ['Current Goal', pm.currentGoal],
      ['Completed Work', pm.completedWork],
      ['Key Decisions', pm.keyDecisions],
      ['Known Risks', pm.knownRisks],
      ['Blockers', pm.blockers],
      ['Next Actions', pm.nextActions],
      ['Open Questions', pm.openQuestions],
      ['Test Strategy', pm.testStrategy],
      ['Release Notes', pm.releaseNotes],
    ].filter(([, v]) => v != null);
    return (
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Version {pm.version} &middot; updated {new Date(pm.updatedAt).toLocaleString()}</p>
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/5 bg-white/[0.02] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-xs text-slate-200">{String(value)}</p>
          </div>
        ))}
        {rows.length === 0 && <EmptyState label="Project memory is empty." />}
      </div>
    );
  };

  const renderTask = () => {
    const tm = memory.taskMemory as TaskMemory | undefined;
    if (!tm) return <EmptyState label="No task memory yet." />;
    const rows = [
      ['Objective', tm.objective],
      ['Context', tm.context],
      ['Investigation', tm.investigation],
      ['Implementation', tm.implementation],
      ['Files Touched', tm.filesTouched],
      ['Commands Run', tm.commandsRun],
      ['Validation', tm.validation],
      ['Decisions', tm.decisions],
      ['Blockers', tm.blockers],
      ['Remaining Work', tm.remainingWork],
      ['Next Action', tm.nextAction],
    ].filter(([, v]) => v != null);
    return (
      <div className="space-y-2">
        <p className="text-[10px] uppercase tracking-wider text-slate-500">Version {tm.version} &middot; updated {new Date(tm.updatedAt).toLocaleString()}</p>
        {rows.map(([label, value]) => (
          <div key={label} className="rounded-md border border-white/5 bg-white/[0.02] p-2.5">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
            <p className="mt-1 text-xs text-slate-200">{String(value)}</p>
          </div>
        ))}
        {rows.length === 0 && <EmptyState label="Task memory is empty." />}
      </div>
    );
  };

  const renderDecisions = () => {
    const decisions = (memory.decisions as DecisionRecord[]) || [];
    if (decisions.length === 0) return <EmptyState label="No decisions recorded." />;
    return (
      <div className="space-y-2">
        {decisions.map((d) => (
          <div key={d.id} className={`rounded-md border p-2.5 ${d.status === 'active' ? 'border-blue-400/20 bg-blue-500/5' : 'border-white/5 bg-white/[0.02]'}`}>
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold text-slate-200">{d.title}</p>
              <span className={`rounded-full px-2 py-0.5 text-[10px] uppercase tracking-wide ${d.status === 'active' ? 'bg-blue-400/15 text-blue-300' : 'bg-slate-700 text-slate-400'}`}>
                {d.status}
              </span>
            </div>
            <p className="mt-1 text-xs text-slate-300">{d.decision}</p>
            {d.rationale && <p className="mt-1 text-[11px] text-slate-400">Why: {d.rationale}</p>}
            {d.alternatives && <p className="mt-1 text-[11px] text-slate-500">Alternatives: {d.alternatives}</p>}
            <p className="mt-1 text-[10px] text-slate-600">{new Date(d.createdAt).toLocaleString()}</p>
          </div>
        ))}
      </div>
    );
  };

  const renderCheckpoints = () => {
    const cps = (memory.checkpoints as ExecutionCheckpoint[]) || [];
    if (cps.length === 0) return <EmptyState label="No checkpoints yet." />;
    return (
      <div className="space-y-2">
        {cps.map((cp) => (
          <div key={cp.id} className="rounded-md border border-white/5 bg-white/[0.02] p-2.5">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-emerald-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-300">
                {cp.phase}
              </span>
              <span className="text-[10px] text-slate-500">{new Date(cp.createdAt).toLocaleString()}</span>
            </div>
            {cp.changedFiles && (
              <p className="mt-1 text-[11px] text-slate-400">Files: {cp.changedFiles}</p>
            )}
            {cp.modelSummary && (
              <p className="mt-1 text-xs text-slate-300">{cp.modelSummary}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  const renderHandoffs = () => {
    const ho = (memory.handoffs as HandoffRecord[]) || [];
    if (ho.length === 0) return <EmptyState label="No handoffs yet." />;
    return (
      <div className="space-y-2">
        {ho.map((h) => (
          <div key={h.id} className="rounded-md border border-white/5 bg-white/[0.02] p-2.5">
            <div className="flex items-center justify-between">
              <span className="rounded-full bg-purple-400/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-purple-300">
                {h.type}
              </span>
              <span className="text-[10px] text-slate-500">{new Date(h.createdAt).toLocaleString()}</span>
            </div>
            <p className="mt-1 text-xs text-slate-300">{h.summary}</p>
            {h.completedWork && (
              <p className="mt-1 text-[11px] text-slate-400">Completed: {h.completedWork}</p>
            )}
            {h.remainingWork && (
              <p className="mt-0.5 text-[11px] text-amber-300">Remaining: {h.remainingWork}</p>
            )}
            {h.nextActions && (
              <p className="mt-0.5 text-[11px] text-slate-400">Next: {h.nextActions}</p>
            )}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col rounded-xl border border-white/10 bg-slate-900/80">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-3">
        <div className="flex items-center gap-2">
          <FaMemory className="h-3.5 w-3.5 text-indigo-300" />
          <h3 className="text-sm font-semibold text-white">Memory</h3>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 text-slate-400 hover:text-white">
          &times;
        </button>
      </div>

      <div className="flex items-center gap-1 border-b border-white/10 px-4 py-2 overflow-x-auto">
        {([
          { key: 'project', label: 'Project', Icon: FaDatabase },
          { key: 'task',    label: 'Task',    Icon: FaTasks },
          { key: 'decisions', label: 'Decisions', Icon: FaBook },
          { key: 'checkpoints', label: 'Checkpoints', Icon: FaCheck },
          { key: 'handoffs', label: 'Handoffs', Icon: FaRandom },
        ] as { key: MemoryTab; label: string; Icon: React.ElementType }[]).map(({ key, label, Icon }) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key)}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium whitespace-nowrap transition-colors ${
              tab === key ? 'bg-white/10 text-white' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <Icon className="h-3 w-3" />
            {label}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading && <p className="text-xs text-slate-500">Loading...</p>}
        {error && <p className="text-xs text-red-400">{error}</p>}
        {!loading && !error && (
          <>
            {tab === 'project' && renderProject()}
            {tab === 'task'    && renderTask()}
            {tab === 'decisions' && renderDecisions()}
            {tab === 'checkpoints' && renderCheckpoints()}
            {tab === 'handoffs' && renderHandoffs()}
          </>
        )}
      </div>
    </div>
  );
}

function EmptyState({ label }: { label: string }) {
  return <p className="py-6 text-center text-xs text-slate-500 italic">{label}</p>;
}
