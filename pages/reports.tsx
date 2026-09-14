import React from 'react';
import Layout from '@/components/Layout';
import {useLiveData} from '@/lib/use-live-data';
import { FaChartBar } from 'react-icons/fa';

async function loadReports() {
	const r = await fetch('/api/reports');
	if (!r.ok) throw new Error('Unable to load reports');
	return r.json();
}

export default function ReportsPage() {
	const {data, error} = useLiveData(loadReports);

	const summaryStats = data
		? [
				{ label: 'Total Tasks', value: data.totalTasks, color: 'text-blue-400', bg: 'bg-blue-400/10' },
				{ label: 'Completed', value: data.completed, color: 'text-green-400', bg: 'bg-green-400/10' },
				{ label: 'Blocked', value: data.blocked, color: 'text-red-400', bg: 'bg-red-400/10' },
			]
		: [];

	return (
		<Layout activeNav="reports">
			<div className="space-y-6 transition-colors duration-200">
				<div>
					<h1 className="text-2xl font-bold text-[var(--text-primary)]">Reports</h1>
					<p className="text-sm text-[var(--text-secondary)] mt-1">
						Current database totals and breakdowns.
					</p>
				</div>

				{error && (
					<div role="alert" className="status-badge error text-sm">
						{error}
					</div>
				)}

				{!data ? (
					<p className="text-[var(--text-secondary)]">Loading reports...</p>
				) : (
					<>
						<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
							{summaryStats.map((s) => (
								<div key={s.label} className="stat-card">
									<div className="flex items-start justify-between">
										<div>
											<p className="text-xs text-[var(--text-secondary)] mb-1">{s.label}</p>
											<p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
										</div>
										<div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>
											<FaChartBar className="w-4 h-4" />
										</div>
									</div>
								</div>
							))}
						</div>

						{['teams', 'sprints'].map((group) => (
							<div key={group} className="page-panel">
								<div className="section-header">
									<h2 className="capitalize">{group}</h2>
								</div>
								<div className="overflow-x-auto">
									<table className="w-full text-sm text-left">
										<thead>
											<tr className="text-xs text-[var(--text-tertiary)] border-b border-[var(--border-default)]">
												<th className="text-left py-2 px-2 font-medium">Name</th>
												<th className="text-left py-2 px-2 font-medium">Tasks</th>
												<th className="text-left py-2 px-2 font-medium">Completed</th>
												<th className="text-left py-2 px-2 font-medium">Completion</th>
											</tr>
										</thead>
										<tbody>
											{data[group].map((row: { id: string; name: string; total: number; completed: number }) => (
												<tr key={row.id} className="border-b border-[var(--border-default)]">
													<td className="py-3 px-2 text-[var(--text-primary)]">{row.name}</td>
													<td className="py-3 px-2 text-[var(--text-secondary)]">{row.total}</td>
													<td className="py-3 px-2 text-[var(--text-secondary)]">{row.completed}</td>
													<td className="py-3 px-2 text-[var(--text-secondary)]">
														{row.total ? Math.round((row.completed / row.total) * 100) : 0}%
													</td>
												</tr>
											))}
										</tbody>
									</table>
								</div>
							</div>
						))}

						<p className="text-xs text-[var(--text-tertiary)]">
							Current database totals, updated when data changes. Historical burndown, code quality, and cycle time require additional event history.
						</p>
					</>
				)}
			</div>
		</Layout>
	);
}
