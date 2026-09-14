import React from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import ActivityFeed from '@/components/ActivityFeed';
import api from '@/lib/api-client';
import {useLiveData} from '@/lib/use-live-data';
import {
	FaUsers,
	FaProjectDiagram,
	FaTasks,
	FaRobot,
	FaChartLine,
	FaDollarSign,
} from 'react-icons/fa';

async function loadOverview() {
	const [teams, projects, tasks, agents, activities, usage] = await Promise.all([
		api.getTeams(),
		api.getProjects(),
		api.getTasks(),
		api.getAgents(),
		api.getActivities(),
		api.getCost(),
	]);
	return { teams, projects, tasks, agents, activities, usage };
}

export default function Overview() {
	const { data, error } = useLiveData(loadOverview);

	const stats = data
		? [
				{ label: 'Teams', value: data.teams.length, icon: FaUsers, color: 'text-blue-400', bg: 'bg-blue-400/10' },
				{ label: 'Projects', value: data.projects.length, icon: FaProjectDiagram, color: 'text-purple-400', bg: 'bg-purple-400/10' },
				{ label: 'Open Tasks', value: data.tasks.filter((t: any) => t.status !== 'done').length, icon: FaTasks, color: 'text-orange-400', bg: 'bg-orange-400/10' },
				{ label: 'Working Agents', value: data.agents.filter((a: any) => a.status === 'working').length, icon: FaRobot, color: 'text-green-400', bg: 'bg-green-400/10' },
			]
		: [];

	return (
		<Layout activeNav="overview">
			<div className="transition-colors duration-200 space-y-6">
				{/* Welcome */}
				<div>
					<h1 className="text-2xl font-bold text-[var(--text-primary)]">Overview</h1>
					<p className="text-sm text-[var(--text-secondary)] mt-1">
						Teams, projects and agent activity. Updates when data changes.
					</p>
				</div>

				{error && (
					<div role="alert" className="status-badge error text-sm">
						{error}
					</div>
				)}

				{!data ? (
					<p className="text-[var(--text-secondary)]">Loading dashboard...</p>
				) : (
					<div className="space-y-6">
						{/* Stat cards */}
						<div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
							{stats.map((s) => {
								const Icon = s.icon;
								return (
									<div key={s.label} className="stat-card">
										<div className="flex items-start justify-between">
											<div>
												<p className="text-xs text-[var(--text-secondary)] mb-1">{s.label}</p>
												<p className="text-2xl font-bold text-[var(--text-primary)]">{s.value}</p>
											</div>
											<div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>
												<Icon className="w-4 h-4" />
											</div>
										</div>
									</div>
								);
							})}
						</div>

						{/* Teams quick view */}
						<div className="page-panel">
							<div className="section-header">
								<div>
									<h2>Teams</h2>
									<p>{data.teams.length} teams configured</p>
								</div>
							</div>
							<div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
								{data.teams.slice(0, 6).map((t: any) => (
									<Link
										href={'/teams/' + t.id}
										key={t.id}
										className="block p-4 rounded-lg border border-[var(--border-default)] bg-[var(--surface-card)] hover:border-[var(--accent)] transition-colors duration-150"
									>
										<h3 className="font-medium text-[var(--text-primary)]">{t.name}</h3>
										<p className="text-sm text-[var(--text-secondary)] mt-0.5 line-clamp-1">
											{t.description || 'No description'}
										</p>
										<p className="text-xs text-[var(--text-tertiary)] mt-2">
											{(t.members || []).length} members
										</p>
									</Link>
								))}
							</div>
						</div>

						{/* Activity */}
						<ActivityFeed activities={data.activities} live={!error} />
					</div>
				)}
			</div>
		</Layout>
	);
}
