import React from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api-client';
import {useLiveData} from '@/lib/use-live-data';
import { FaChartLine, FaDollarSign, FaMicrochip } from 'react-icons/fa';

export default function CostPage() {
	const {data, error} = useLiveData(api.getCost);

	const stats = data
		? [
				{ label: 'Total Tokens', value: data.totalTokens.toLocaleString(), icon: FaMicrochip, color: 'text-blue-400', bg: 'bg-blue-400/10' },
				{ label: 'Measured Calls', value: String(data.measuredCalls), icon: FaChartLine, color: 'text-green-400', bg: 'bg-green-400/10' },
				{ label: 'Recorded Cost', value: data.totalCost === null ? 'Unavailable' : '$' + data.totalCost.toFixed(4), icon: FaDollarSign, color: 'text-orange-400', bg: 'bg-orange-400/10' },
			]
		: [];

	return (
		<Layout activeNav="cost">
			<div className="space-y-6 transition-colors duration-200">
				<div>
					<h1 className="text-2xl font-bold text-[var(--text-primary)]">Cost & Usage</h1>
					<p className="text-sm text-[var(--text-secondary)] mt-1">
						Track token usage and AI costs across all agents and teams.
					</p>
				</div>

				{error && (
					<div role="alert" className="status-badge error text-sm">
						{error}
					</div>
				)}

				{!data ? (
					<p className="text-[var(--text-secondary)]">Loading usage...</p>
				) : (
					<>
						{stats.length > 0 && (
							<div className="grid grid-cols-1 md:grid-cols-3 gap-4">
								{stats.map((s) => {
									const Icon = s.icon;
									return (
										<div key={s.label} className="stat-card">
											<div className="flex items-start justify-between">
												<div>
													<p className="text-xs text-[var(--text-secondary)] mb-1">{s.label}</p>
													<p className="text-xl font-bold text-[var(--text-primary)]">{s.value}</p>
												</div>
												<div className={`p-2 rounded-lg ${s.bg} ${s.color}`}>
													<Icon className="w-4 h-4" />
												</div>
											</div>
										</div>
									);
								})}
							</div>
						)}

						<div className="page-panel">
							<div className="section-header">
								<h2>Usage Details</h2>
								<p>Detailed breakdown of token usage and costs</p>
							</div>
							<div className="space-y-3">
								<div className="flex items-center justify-between py-2 border-b border-[var(--border-default)]">
									<span className="text-sm text-[var(--text-secondary)]">Measured Tokens</span>
									<span className="text-sm font-medium text-[var(--text-primary)]">{data.totalTokens.toLocaleString()}</span>
								</div>
								<div className="flex items-center justify-between py-2 border-b border-[var(--border-default)]">
									<span className="text-sm text-[var(--text-secondary)]">Calls with Recorded Usage</span>
									<span className="text-sm font-medium text-[var(--text-primary)]">{data.measuredCalls}</span>
								</div>
								<div className="flex items-center justify-between py-2">
									<span className="text-sm text-[var(--text-secondary)]">Recorded Cost</span>
									<span className="text-sm font-medium text-[var(--text-primary)]">
										{data.totalCost === null ? 'Unavailable' : '$' + data.totalCost.toFixed(4)}
									</span>
								</div>
							</div>
						</div>

						{data.measuredCalls === 0 && (
							<div className="page-panel text-center py-8">
								<p className="text-sm text-[var(--text-secondary)]">
									No measured AI usage has been recorded yet.
								</p>
							</div>
						)}
					</>
				)}
			</div>
		</Layout>
	);
}
