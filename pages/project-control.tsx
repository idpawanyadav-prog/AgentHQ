import React, { useEffect, useMemo, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api-client';
import {
	FaBriefcase,
	FaChartLine,
	FaCheck,
	FaExclamationTriangle,
	FaMinus,
	FaPaperPlane,
	FaPlus,
	FaProjectDiagram,
	FaRobot,
	FaSpinner,
	FaTasks,
	FaTimes,
	FaUserCog,
} from 'react-icons/fa';

type Persona = 'project-control' | 'scrum-master' | 'business-analyst';
type ChatMessage = { role: 'user' | 'assistant'; content: string };
type StaffingHire = { name: string; role: string; configuredModelId: string; roleGroupId?: string | null };
type StaffingRemoval = { agentId: string; name: string; role: string; reason: string };
type StaffingProposal = {
	currentAgentCount: number;
	targetAgentCount: number;
	hires: StaffingHire[];
	removals: StaffingRemoval[];
	reason: string;
	warnings: string[];
	requiresApproval: true;
};

type ProjectControlStatus = {
	project: { id: string; name: string; description?: string; status: string; progress: number; repoUrl?: string; repositoryMode?: string; repositoryStatus?: string; defaultBranch?: string };
	team: { id: string; name: string; status: string; memberCount: number; humanMemberCount: number; agentCount: number };
	agents: Array<{ id: string; name: string; role: string; status: string; activeTaskCount: number; blockedTaskCount: number; capacity: string }>;
	taskCounts: Record<string, number>;
	summary: { openTaskCount: number; blockedTaskCount: number; idleAgentCount: number; workingAgentCount: number; reviewQueueCount: number };
	activeSprint: { name: string; goal?: string; status: string; taskCount: number; completedCount: number; blockedCount: number } | null;
	tasks: Array<{ id: string; title: string; status: string; priority: string; assignedAgent?: { name: string } | null; blocked: boolean; blockedReason?: string | null }>;
	milestones: Array<{ id: string; title: string; status: string; order: number }>;
	risks: Array<{ id: string; severity: string; label: string; detail: string }>;
};

const PERSONAS: Array<{ id: Persona; label: string }> = [
	{ id: 'project-control', label: 'Project Control' },
	{ id: 'scrum-master', label: 'Scrum Master' },
	{ id: 'business-analyst', label: 'Business Analyst' },
];

function StatTile({ label, value, icon }: { label: string; value: string | number; icon: React.ReactNode }) {
	return (
		<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
			<div className="flex items-center justify-between gap-3">
				<div>
					<p className="text-xs text-slate-400">{label}</p>
					<p className="text-xl font-semibold text-[var(--text-primary)] mt-1">{value}</p>
				</div>
				<div className="text-blue-400 bg-blue-400/10 rounded-md p-2">{icon}</div>
			</div>
		</div>
	);
}

function ProposalEditor({
	proposal,
	onChange,
	onApprove,
	onReject,
	applying,
}: {
	proposal: StaffingProposal;
	onChange: (proposal: StaffingProposal) => void;
	onApprove: () => void;
	onReject: () => void;
	applying: boolean;
}) {
	const updateHire = (index: number, field: keyof StaffingHire, value: string) => {
		onChange({
			...proposal,
			hires: proposal.hires.map((hire, i) => i === index ? { ...hire, [field]: value } : hire),
		});
	};
	const removeHire = (index: number) => {
		onChange({ ...proposal, hires: proposal.hires.filter((_, i) => i !== index) });
	};
	return (
		<div className="bg-[var(--surface-card)] border border-blue-500/40 rounded-lg p-4 space-y-4">
			<div className="flex items-start justify-between gap-3">
				<div>
					<h2 className="text-sm font-semibold text-[var(--text-primary)]">Staffing Proposal</h2>
					<p className="text-xs text-slate-400 mt-1">Current Agents: {proposal.currentAgentCount} · Proposed Agents: {proposal.targetAgentCount}</p>
				</div>
				<button type="button" onClick={onReject} className="text-slate-400 hover:text-red-300" title="Reject proposal">
					<FaTimes className="w-4 h-4" />
				</button>
			</div>
			{proposal.hires.length > 0 && (
				<div className="space-y-2">
					<p className="text-xs font-medium text-slate-300">Add</p>
					{proposal.hires.map((hire, index) => (
						<div key={`${hire.name}-${index}`} className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-2">
							<input value={hire.name} onChange={(e) => updateHire(index, 'name', e.target.value)} className="bg-[#1d1f33] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)]" />
							<input value={hire.role} onChange={(e) => updateHire(index, 'role', e.target.value)} className="bg-[#1d1f33] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)]" />
							<button type="button" onClick={() => removeHire(index)} className="px-3 py-2 rounded-md border border-[var(--border-default)] text-slate-400 hover:text-red-300">
								<FaTimes className="w-3 h-3" />
							</button>
						</div>
					))}
				</div>
			)}
			{proposal.removals.length > 0 && (
				<div className="space-y-2">
					<p className="text-xs font-medium text-slate-300">Move To Bench</p>
					{proposal.removals.map((removal) => (
						<div key={removal.agentId} className="text-sm text-slate-300 bg-[var(--bg-secondary)] rounded-md px-3 py-2">
							{removal.name} · {removal.role}
							<p className="text-xs text-slate-500 mt-1">{removal.reason}</p>
						</div>
					))}
				</div>
			)}
			<p className="text-xs text-slate-400">{proposal.reason}</p>
			{proposal.warnings.length > 0 && (
				<div className="space-y-1">
					{proposal.warnings.map((warning) => <p key={warning} className="text-xs text-amber-300">{warning}</p>)}
				</div>
			)}
			<div className="flex flex-wrap gap-2">
				<button
					type="button"
					disabled={applying}
					onClick={onApprove}
					className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm px-4 py-2 rounded-md flex items-center gap-2"
				>
					{applying ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FaCheck className="w-3 h-3" />}
					Approve Changes
				</button>
				<button type="button" onClick={onReject} className="text-sm text-slate-300 border border-[var(--border-default)] rounded-md px-4 py-2 hover:bg-[var(--bg-secondary)]">
					Reject
				</button>
			</div>
		</div>
	);
}

export default function ProjectControlPage() {
	const [projects, setProjects] = useState<Array<{ id: string; name: string; status: string }>>([]);
	const [projectId, setProjectId] = useState('');
	const [status, setStatus] = useState<ProjectControlStatus | null>(null);
	const [persona, setPersona] = useState<Persona>('project-control');
	const [messages, setMessages] = useState<ChatMessage[]>([]);
	const [message, setMessage] = useState('');
	const [targetCount, setTargetCount] = useState(0);
	const [proposal, setProposal] = useState<StaffingProposal | null>(null);
	const [executionProposal, setExecutionProposal] = useState<Record<string, any> | null>(null);
	const [runs, setRuns] = useState<Array<Record<string, any>>>([]);
	const [squads, setSquads] = useState<Array<Record<string, any>>>([]);
	const [governance, setGovernance] = useState<Record<string, any> | null>(null);
	const [loading, setLoading] = useState(true);
	const [chatting, setChatting] = useState(false);
	const [proposing, setProposing] = useState(false);
	const [applying, setApplying] = useState(false);
	const [error, setError] = useState<string | null>(null);

	useEffect(() => {
		let cancelled = false;
		api.getProjects()
			.then((data) => {
				if (cancelled) return;
				const items = Array.isArray(data) ? data : [];
				setProjects(items);
				const active = items.filter((item: any) => item.status === 'active');
				const selected = active.length === 1 ? active[0] : items[0];
				if (selected && !projectId) setProjectId(selected.id);
			})
			.catch((err) => setError(err instanceof Error ? err.message : 'Failed to load projects'))
			.finally(() => !cancelled && setLoading(false));
		return () => { cancelled = true; };
	}, []);

	useEffect(() => {
		if (!projectId) {
			setStatus(null);
			return;
		}
		let cancelled = false;
		setError(null);
		Promise.all([
			api.getProjectControlStatus(projectId),
			api.getProjectGovernance(projectId).catch(() => null),
			api.getSquads(projectId).catch(() => []),
		])
			.then(([data, governanceData, squadData]) => {
				if (cancelled) return;
				setStatus(data);
				setTargetCount(data.team.agentCount);
				setProposal(null);
				setExecutionProposal(null);
				setGovernance(governanceData);
				setSquads(Array.isArray(squadData) ? squadData : []);
			})
			.catch((err) => setError(err instanceof Error ? err.message : 'Failed to load Project Control status'));
		return () => { cancelled = true; };
	}, [projectId]);

	useEffect(() => {
		if (!projectId) return;
		api.getProject(projectId)
			.then((data) => {
				setRuns(Array.isArray(data.executionRuns) ? data.executionRuns : []);
			})
			.catch(() => setRuns([]));
	}, [projectId, status]);

	const visibleTasks = useMemo(() => (status?.tasks || []).filter((task) => task.status !== 'done').slice(0, 8), [status]);

	const refreshStatus = async () => {
		if (!projectId) return;
		const next = await api.getProjectControlStatus(projectId);
		setStatus(next);
		setTargetCount(next.team.agentCount);
	};

	const sendMessage = async (e: React.FormEvent) => {
		e.preventDefault();
		if (!message.trim()) return;
		const userMessage = message.trim();
		setMessage('');
		setMessages((current) => [...current, { role: 'user', content: userMessage }]);
		setChatting(true);
		setError(null);
		try {
			const response = await api.chatProjectControl({ projectId: projectId || '', persona, message: userMessage, history: messages });
			setMessages((current) => [...current, { role: 'assistant', content: response.reply }]);
			if (response.staffingProposal) setProposal(response.staffingProposal);
			if (response.projectId && !projectId) setProjectId(response.projectId);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Project Control chat failed');
		} finally {
			setChatting(false);
		}
	};

	const requestProposal = async () => {
		if (!projectId) return;
		setProposing(true);
		setError(null);
		try {
			const next = await api.proposeStaffing({ projectId, requirement: message, targetAgentCount: targetCount });
			setProposal(next);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to propose staffing');
		} finally {
			setProposing(false);
		}
	};

	const approveProposal = async () => {
		if (!proposal || !projectId) return;
		setApplying(true);
		setError(null);
		try {
			await api.applyStaffing({ projectId, approved: true, hires: proposal.hires, removals: proposal.removals });
			setProposal(null);
			await refreshStatus();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to apply staffing');
		} finally {
			setApplying(false);
		}
	};

	const requestExecutionProposal = async () => {
		if (!projectId || !message.trim()) return;
		setProposing(true);
		setError(null);
		try {
			const next = await api.proposeExecution({ projectId, message: message.trim(), mode: 'coding' });
			setExecutionProposal(next);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to propose execution');
		} finally {
			setProposing(false);
		}
	};

	const approveExecutionProposal = async () => {
		if (!executionProposal) return;
		setApplying(true);
		setError(null);
		try {
			await api.approveExecution(String(executionProposal.id || executionProposal.proposalId), { approved: true });
			setExecutionProposal(null);
			await refreshStatus();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to approve execution');
		} finally {
			setApplying(false);
		}
	};

	const saveGovernance = async () => {
		if (!projectId || !governance) return;
		const saved = await api.updateProjectGovernance(projectId, governance);
		setGovernance(saved);
	};

	return (
		<Layout activeNav="project-control">
			<div className="w-full min-w-0 space-y-5">
				<div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
					<div>
						<h1 className="text-2xl font-bold text-[var(--text-primary)] flex items-center gap-3">
							<FaProjectDiagram className="text-blue-400" />
							Project Control
						</h1>
						<p className="text-sm text-slate-400 mt-1">Manage delivery with grounded chat and approval-based staffing.</p>
					</div>
					{projects.length > 0 && (
						<select
							value={projectId}
							onChange={(e) => setProjectId(e.target.value)}
							className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-slate-200 min-w-[240px]"
						>
							{projects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
						</select>
					)}
				</div>

				{loading && <p className="text-sm text-slate-400">Loading Project Control...</p>}
				{!loading && projects.length === 0 && (
					<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-8 text-center">
						<p className="text-slate-300">Create a Project first.</p>
					</div>
				)}
				{error && <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-3 text-sm text-red-300">{error}</div>}

				{projectId && !status && !error && (
					<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-8 text-center">
						<FaSpinner className="w-6 h-6 animate-spin text-blue-400 mx-auto mb-3" />
						<p className="text-slate-300">Loading project context...</p>
					</div>
				)}

				{status && (
					<>
						<div className="grid grid-cols-2 lg:grid-cols-4 xl:grid-cols-8 gap-3">
							<StatTile label="Progress" value={`${status.project.progress}%`} icon={<FaChartLine />} />
							<StatTile label="Sprint" value={status.activeSprint?.name || 'None'} icon={<FaBriefcase />} />
							<StatTile label="Open Tasks" value={status.summary.openTaskCount} icon={<FaTasks />} />
							<StatTile label="Blocked" value={status.summary.blockedTaskCount} icon={<FaExclamationTriangle />} />
							<StatTile label="AI Agents" value={status.team.agentCount} icon={<FaRobot />} />
							<StatTile label="Idle" value={status.summary.idleAgentCount} icon={<FaUserCog />} />
							<StatTile label="Working" value={status.summary.workingAgentCount} icon={<FaSpinner />} />
							<StatTile label="Review" value={status.summary.reviewQueueCount} icon={<FaCheck />} />
						</div>

						<div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-5">
							<div className="space-y-4">
								<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4 space-y-3">
									<div>
										<h2 className="text-sm font-semibold text-[var(--text-primary)]">{status.project.name}</h2>
										<p className="text-xs text-slate-400 mt-1">{status.team.name} · {status.project.status}</p>
									</div>
									<div className="w-full bg-[var(--bg-tertiary)] rounded-full h-2">
										<div className="bg-blue-500 h-2 rounded-full" style={{ width: `${status.project.progress}%` }} />
									</div>
									{status.activeSprint && (
										<p className="text-xs text-slate-400">
											{status.activeSprint.completedCount}/{status.activeSprint.taskCount} sprint tasks complete · {status.activeSprint.blockedCount} blocked
										</p>
									)}
								</div>

								<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4 space-y-3">
									<h2 className="text-sm font-semibold text-[var(--text-primary)]">Staffing</h2>
									<div className="flex items-center justify-between gap-2">
										<button type="button" onClick={() => setTargetCount(Math.max(0, targetCount - 1))} className="p-2 rounded-md border border-[var(--border-default)] text-slate-300 hover:bg-[var(--bg-secondary)]">
											<FaMinus className="w-3 h-3" />
										</button>
										<input value={targetCount} onChange={(e) => setTargetCount(Math.max(0, Number(e.target.value) || 0))} className="w-20 text-center bg-[#1d1f33] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)]" />
										<button type="button" onClick={() => setTargetCount(targetCount + 1)} className="p-2 rounded-md border border-[var(--border-default)] text-slate-300 hover:bg-[var(--bg-secondary)]">
											<FaPlus className="w-3 h-3" />
										</button>
									</div>
									<button type="button" onClick={requestProposal} disabled={proposing} className="w-full bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm px-4 py-2 rounded-md flex items-center justify-center gap-2">
										{proposing ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FaUserCog className="w-3 h-3" />}
										Propose Staffing
									</button>
									<button type="button" onClick={requestExecutionProposal} disabled={proposing || !message.trim()} className="w-full border border-[var(--border-default)] hover:bg-[var(--bg-secondary)] disabled:opacity-60 text-slate-200 text-sm px-4 py-2 rounded-md flex items-center justify-center gap-2">
										<FaProjectDiagram className="w-3 h-3" />
										Propose Execution
									</button>
								</div>

								<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4 space-y-2">
									<h2 className="text-sm font-semibold text-[var(--text-primary)]">Agents</h2>
									{status.agents.map((agent) => (
										<div key={agent.id} className="flex items-center justify-between gap-3 text-sm">
											<div className="min-w-0">
												<p className="text-slate-200 truncate">{agent.name}</p>
												<p className="text-xs text-slate-500">{agent.role}</p>
											</div>
											<span className="text-xs text-slate-400">{agent.capacity}</span>
										</div>
									))}
								</div>
							</div>

							<div className="space-y-4 min-w-0">
								<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
									<div className="flex flex-wrap gap-2 mb-4">
										{PERSONAS.map((item) => (
											<button
												key={item.id}
												type="button"
												onClick={() => setPersona(item.id)}
												className={`text-sm px-3 py-2 rounded-md border transition-colors ${persona === item.id ? 'bg-blue-600 border-blue-500 text-white' : 'border-[var(--border-default)] text-slate-300 hover:bg-[var(--bg-secondary)]'}`}
											>
												{item.label}
											</button>
										))}
									</div>
									<div className="h-[420px] overflow-y-auto space-y-3 pr-1">
										{messages.length === 0 && (
											<p className="text-sm text-slate-400">Ask for project status, blockers, requirements, staffing, sprint risk, or BA refinement. Type "create a new Weather Teller project" to bootstrap one.</p>
										)}
										{messages.map((item, index) => (
											<div key={index} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${item.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'bg-[var(--bg-secondary)] text-slate-200'}`}>
												{item.content}
											</div>
										))}
										{chatting && <div className="text-sm text-slate-400 flex items-center gap-2"><FaSpinner className="animate-spin" /> Thinking...</div>}
									</div>
									<form onSubmit={sendMessage} className="mt-4 flex gap-2">
										<input
											value={message}
											onChange={(e) => setMessage(e.target.value)}
											placeholder="Ask Project Control, or say 'create a new project'..."
											className="flex-1 bg-[#1d1f33] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)]"
										/>
										<button type="submit" disabled={chatting || !message.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white px-4 py-2 rounded-md">
											<FaPaperPlane className="w-3 h-3" />
										</button>
									</form>
								</div>

								{proposal && (
									<ProposalEditor
										proposal={proposal}
										onChange={setProposal}
										onApprove={approveProposal}
										onReject={() => setProposal(null)}
										applying={applying}
									/>
								)}

								{executionProposal && (
									<div className="bg-[var(--surface-card)] border border-amber-500/40 rounded-lg p-4 space-y-3">
										<h2 className="text-sm font-semibold text-[var(--text-primary)]">Execution Proposal</h2>
										<p className="text-xs text-slate-400">Engine: {executionProposal.engine} · Risk: {executionProposal.risk} · Branch: {executionProposal.branch}</p>
										{executionProposal.implications?.map((item: string) => <p key={item} className="text-sm text-slate-300">- {item}</p>)}
										{executionProposal.blockers?.map((item: string) => <p key={item} className="text-sm text-red-300">{item}</p>)}
										<div className="flex gap-2">
											<button type="button" disabled={applying || executionProposal.blockers?.length > 0} onClick={approveExecutionProposal} className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white text-sm px-4 py-2 rounded-md">
												Approve Run
											</button>
											<button type="button" onClick={() => setExecutionProposal(null)} className="border border-[var(--border-default)] text-sm text-slate-300 px-4 py-2 rounded-md">Reject</button>
										</div>
									</div>
								)}

								<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
									<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4 space-y-2">
										<h2 className="text-sm font-semibold text-[var(--text-primary)]">Risks</h2>
										{status.risks.length === 0 ? <p className="text-sm text-slate-400">No deterministic risks detected.</p> : status.risks.map((risk) => (
											<div key={risk.id} className="text-sm text-slate-300">
												<p>{risk.label}</p>
												<p className="text-xs text-slate-500">{risk.detail}</p>
											</div>
										))}
									</div>
									<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4 space-y-2">
										<h2 className="text-sm font-semibold text-[var(--text-primary)]">Open Work</h2>
										{visibleTasks.map((task) => (
											<div key={task.id} className="text-sm text-slate-300">
												<p className="truncate">{task.title}</p>
												<p className="text-xs text-slate-500">{task.status} · {task.priority}{task.assignedAgent ? ` · ${task.assignedAgent.name}` : ''}</p>
											</div>
										))}
									</div>
								</div>
								<div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
									<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4 space-y-2">
										<h2 className="text-sm font-semibold text-[var(--text-primary)]">Repository</h2>
										<p className="text-sm text-slate-300">Mode: {status.project.repositoryMode || 'none'}</p>
										<p className="text-sm text-slate-300">Status: {status.project.repositoryStatus || 'unconfigured'}</p>
										<p className="text-sm text-slate-300">Default branch: {status.project.defaultBranch || 'main'}</p>
										<p className="text-xs text-slate-500 truncate">{status.project.repoUrl || 'No repository configured'}</p>
									</div>
									<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4 space-y-2">
										<h2 className="text-sm font-semibold text-[var(--text-primary)]">Recent Runs</h2>
										{runs.length === 0 ? <p className="text-sm text-slate-400">No execution runs yet.</p> : runs.slice(0, 5).map((run) => (
											<div key={run.id} className="text-sm text-slate-300">
												<p>{run.engine} · {run.status}</p>
												<p className="text-xs text-slate-500">{run.id}</p>
											</div>
										))}
									</div>
									<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4 space-y-2">
										<h2 className="text-sm font-semibold text-[var(--text-primary)]">Governance</h2>
										<textarea
											value={governance?.humanDirectives || ''}
											onChange={(e) => setGovernance({ ...(governance || {}), humanDirectives: e.target.value })}
											placeholder="Human directives"
											className="w-full bg-[#1d1f33] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)] min-h-[90px]"
										/>
										<div className="flex flex-wrap gap-3 text-xs text-slate-300">
											<label><input type="checkbox" checked={governance?.allowShell === true} onChange={(e) => setGovernance({ ...(governance || {}), allowShell: e.target.checked })} /> Shell</label>
											<label><input type="checkbox" checked={governance?.allowRemotePush === true} onChange={(e) => setGovernance({ ...(governance || {}), allowRemotePush: e.target.checked })} /> Remote push</label>
											<label><input type="checkbox" checked={governance?.allowAutoPr === true} onChange={(e) => setGovernance({ ...(governance || {}), allowAutoPr: e.target.checked })} /> Auto PR</label>
										</div>
										<button type="button" onClick={saveGovernance} className="bg-blue-600 hover:bg-blue-500 text-white text-sm px-4 py-2 rounded-md">Save Governance</button>
									</div>
									<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4 space-y-2">
										<h2 className="text-sm font-semibold text-[var(--text-primary)]">Squads</h2>
										{squads.length === 0 ? <p className="text-sm text-slate-400">No dynamic squads yet.</p> : squads.slice(0, 5).map((squad) => (
											<div key={squad.id} className="text-sm text-slate-300">
												<p>{squad.name} · {squad.status}</p>
												<p className="text-xs text-slate-500">{squad.members?.length || 0} members</p>
											</div>
										))}
									</div>
								</div>
							</div>
						</div>
					</>
				)}

				{/* Always-visible Chat */}
				<div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg p-4">
					<h2 className="text-sm font-semibold text-[var(--text-primary)] mb-3">Project Control Chat</h2>
					<div className="h-[420px] overflow-y-auto space-y-3 pr-1">
						{messages.length === 0 && (
							<p className="text-sm text-slate-400">Ask for project status, blockers, requirements, staffing, sprint risk, or BA refinement. Type "create a new Weather Teller project" to bootstrap one from scratch.</p>
						)}
						{messages.map((item, index) => (
							<div key={index} className={`max-w-[85%] rounded-lg px-3 py-2 text-sm ${item.role === 'user' ? 'ml-auto bg-blue-600 text-white' : 'bg-[var(--bg-secondary)] text-slate-200'}`}>
								{item.content}
							</div>
						))}
						{chatting && <div className="text-sm text-slate-400 flex items-center gap-2"><FaSpinner className="animate-spin" /> Thinking...</div>}
					</div>
					<form onSubmit={sendMessage} className="mt-4 flex gap-2">
						<input
							value={message}
							onChange={(e) => setMessage(e.target.value)}
							placeholder="Ask Project Control, or say 'create a new project'..."
							className="flex-1 bg-[#1d1f33] border border-[var(--border-default)] rounded-md px-3 py-2 text-sm text-[var(--text-primary)]"
						/>
						<button type="submit" disabled={chatting || !message.trim()} className="bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/50 text-white px-4 py-2 rounded-md">
							<FaPaperPlane className="w-3 h-3" />
						</button>
					</form>
				</div>
			</div>
		</Layout>
	);
}
