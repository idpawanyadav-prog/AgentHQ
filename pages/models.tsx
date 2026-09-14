import React from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api-client';
import { useLiveData } from '@/lib/use-live-data';
import { FaMicrochip, FaServer } from 'react-icons/fa';

const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
	anthropic: { bg: 'bg-purple-400/10', text: 'text-purple-400' },
	openai: { bg: 'bg-green-400/10', text: 'text-green-400' },
};

export default function ModelsPage() {
	const { data, error } = useLiveData(api.getModels);

	return (
		<Layout activeNav="models">
			<div className="space-y-6 transition-colors duration-200">
				<div>
					<h1 className="text-2xl font-bold text-[var(--text-primary)]">Models</h1>
					<p className="text-sm text-[var(--text-secondary)] mt-1">
						Models assigned to configured agents.
					</p>
				</div>

				{error && (
					<div role="alert" className="status-badge error text-sm">
						{error}
					</div>
				)}

				{!data ? (
					<p className="text-[var(--text-secondary)]">Loading models...</p>
				) : data.length === 0 ? (
					<div className="page-panel text-center py-12">
						<p className="text-sm text-[var(--text-secondary)]">
							No models assigned. Add an agent first.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{data.map((m: any) => {
							const pc = PROVIDER_COLORS[m.provider?.toLowerCase()] || PROVIDER_COLORS.anthropic;
							return (
								<div key={m.id} className="team-card">
									<div className="flex items-start justify-between mb-2">
										<div className="flex items-center gap-3">
											<div className={`p-2 rounded-lg ${pc.bg}`}>
												<FaMicrochip className={`w-4 h-4 ${pc.text}`} />
											</div>
											<div>
												<h3 className="text-base font-medium text-[var(--text-primary)]">{m.name}</h3>
												<p className="text-xs text-[var(--text-secondary)]">
													{m.provider} &middot; {m.assignments || 0} assignments
												</p>
											</div>
										</div>
									</div>
									{(m.agentNames || []).length > 0 && (
										<div className="mt-3 pt-3 border-t border-[var(--border-default)]">
											<p className="text-xs text-[var(--text-tertiary)] mb-1">Used by agents:</p>
											<p className="text-xs text-[var(--text-secondary)]">
												{m.agentNames.join(', ')}
											</p>
										</div>
									)}
								</div>
							);
						})}
					</div>
				)}
			</div>
		</Layout>
	);
}
