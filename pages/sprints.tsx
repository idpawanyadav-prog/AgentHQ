import React, { useState } from 'react';
import Layout from '@/components/Layout';
import CreateRecord from '@/components/CreateRecord';
import api from '@/lib/api-client';
import { useLiveData } from '@/lib/use-live-data';
import { FaCalendarAlt, FaFlag, FaTasks } from 'react-icons/fa';

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
	planned: { bg: 'bg-slate-400/10', text: 'text-slate-400' },
	active: { bg: 'bg-green-400/10', text: 'text-green-400' },
	completed: { bg: 'bg-blue-400/10', text: 'text-blue-400' },
};

export default function SprintsPage() {
	const { data, error } = useLiveData(api.getSprints);
	const [filter, setFilter] = useState('');

	const filtered = data ? data.filter((s: any) => !filter || s.status === filter) : [];

	return (
		<Layout activeNav="sprints">
			<div className="space-y-6 transition-colors duration-200">
				<div className="flex justify-between items-center">
					<div>
						<h1 className="text-2xl font-bold text-[var(--text-primary)]">Sprints</h1>
						<p className="text-sm text-[var(--text-secondary)] mt-1">
							Manage sprints, track progress, and monitor completion.
						</p>
					</div>
					<CreateRecord kind="sprint" onCreated={() => {}} />
				</div>

				<div className="flex items-center gap-3">
					<label className="text-sm text-[var(--text-secondary)]">Status</label>
					<select
						className="input-field"
						value={filter}
						onChange={(e) => setFilter(e.target.value)}
					>
						<option value="">All statuses</option>
						<option value="planned">Planned</option>
						<option value="active">Active</option>
						<option value="completed">Completed</option>
					</select>
				</div>

				{error && (
					<div role="alert" className="status-badge error text-sm">
						{error}
					</div>
				)}

				{!data ? (
					<p className="text-[var(--text-secondary)]">Loading sprints...</p>
				) : filtered.length === 0 ? (
					<div className="page-panel text-center py-12">
						<p className="text-sm text-[var(--text-secondary)]">
							No sprints yet. Create a sprint to get started.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{filtered.map((s: any) => {
							const completedTasks = (s.tasks || []).filter((t: any) => t.status === 'done').length;
							const totalTasks = (s.tasks || []).length;
							const pct = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 0;
							const sc = STATUS_COLORS[s.status] || STATUS_COLORS.planned;

							return (
								<div key={s.id} className="team-card">
									<div className="flex items-start justify-between mb-3">
										<div>
											<h3 className="text-base font-semibold text-[var(--text-primary)]">{s.name}</h3>
											<p className="text-xs text-[var(--text-secondary)] mt-0.5">
												{s.project?.name || 'No project'} &middot;{' '}
												<span className={`status-badge ${s.status === 'active' ? 'success' : s.status === 'completed' ? 'info' : 'warning'}`}>
													{s.status}
												</span>
											</p>
										</div>
										<FaFlag className="w-4 h-4 text-[var(--text-tertiary)]" />
									</div>

									<p className="text-sm text-[var(--text-secondary)] mb-3 line-clamp-2">{s.goal}</p>

									<div className="flex items-center gap-4 text-xs text-[var(--text-secondary)] mb-3">
										<span className="flex items-center gap-1">
											<FaTasks className="w-3 h-3" />
											{completedTasks} / {totalTasks} tasks
										</span>
										{s.startDate && (
											<span>
												{new Date(s.startDate).toLocaleDateString()} — {s.endDate ? new Date(s.endDate).toLocaleDateString() : '—'}
											</span>
										)}
									</div>

									<div className="progress-bar">
										<div className="progress-bar-fill" style={{ width: `${pct}%` }} />
									</div>
								</div>
							);
						})}
					</div>
				)}
			</div>
		</Layout>
	);
}
