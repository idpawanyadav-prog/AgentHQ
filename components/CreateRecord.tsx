import React, { useState } from 'react';
import api from '@/lib/api-client';
import type { Agent, ConfiguredModel, RoleGroup, Team } from '@/types';

const BENCH_TEAM_NAME = 'On Bench';
const BENCH_TEAM_ID = 'on-bench';

export default function CreateRecord({ kind, onCreated }: { kind: 'agent' | 'sprint'; onCreated: () => void }) {
	const [open, setOpen] = useState(false);
	const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
	const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
	const [configuredModels, setConfiguredModels] = useState<ConfiguredModel[]>([]);
	const [error, setError] = useState('');
	const [busy, setBusy] = useState(false);

	async function show() {
		setOpen(true);
		setError('');
		try {
			if (kind === 'agent') {
				const [teams, groups, models] = await Promise.all([
					api.getTeams(),
					api.getRoleGroups(),
					api.getModels(),
				]);

				let teamOptions: Team[] = Array.isArray(teams) ? teams : [];
				const benchTeam = teamOptions.find((team) => team.id === BENCH_TEAM_ID);
				if (!benchTeam) {
					const createdBench = await api.createTeam({
						name: BENCH_TEAM_NAME,
						description: 'Idle bench for agents not assigned to a delivery team.',
						status: 'paused',
					});
					teamOptions = [createdBench, ...teamOptions];
				}

				setOptions(teamOptions
					.filter((team, index, allTeams) =>
						team.name.toLowerCase() !== BENCH_TEAM_NAME.toLowerCase()
						|| team.id === BENCH_TEAM_ID
						|| !allTeams.some((item) => item.id === BENCH_TEAM_ID)
						|| allTeams.findIndex((item) => item.name.toLowerCase() === BENCH_TEAM_NAME.toLowerCase()) === index
					)
					.map((team) => ({ id: team.id, name: team.name })));
				setRoleGroups(Array.isArray(groups) ? groups : []);
				setConfiguredModels(Array.isArray(models) ? models : []);
			} else {
				const data = await api.getProjects();
				setOptions(data);
				setRoleGroups([]);
				setConfiguredModels([]);
			}
		} catch (e) { setError((e as Error).message); }
	}

	async function submit(e: React.FormEvent<HTMLFormElement>) {
		e.preventDefault();
		setBusy(true);
		setError('');
		const values = new FormData(e.currentTarget);
		try {
			const name = String(values.get('name')).trim();
			if (kind === 'agent') {
				const configuredModelId = String(values.get('configuredModel') || '');
				const configuredModel = configuredModels.find((model) => model.id === configuredModelId);
				if (!configuredModel) throw new Error('Select a configured model');

				const agent = await api.createAgent({
					name,
					teamId: String(values.get('parent')),
					type: configuredModel.provider,
					model: configuredModel.modelId,
					config: {
						gatewayId: configuredModel.gatewayId,
						configuredModelId: configuredModel.id,
					},
				}) as Agent;
				const roleGroupId = String(values.get('roleGroup') || '');
				if (roleGroupId) {
					await api.assignAgent(roleGroupId, {
						agentId: agent.id,
						agentName: agent.name,
						agentStatus: agent.status,
					});
				}
			} else {
				await api.createSprint({ name, projectId: String(values.get('parent')), goal: String(values.get('goal')) });
			}
			setOpen(false);
			onCreated();
		} catch (e) { setError((e as Error).message); }
		finally { setBusy(false); }
	}

	return (
		<>
			<button type="button" onClick={show} className="btn-primary">{kind === 'agent' ? 'Add Agent' : 'New Sprint'}</button>
			{open && (
				<div className="fixed inset-0 flex items-center justify-center p-4" style={{ backgroundColor: 'rgba(0,0,0,0.7)', zIndex: 50, backdropFilter: 'blur(4px)' }}>
					<form onSubmit={submit} role="dialog" aria-modal="true" aria-label={`Create ${kind}`} className="page-panel w-full max-w-md space-y-4">
						<h2 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Create {kind}</h2>
						<label className="block">
							Name
							<input name="name" required className="input-field mt-1" />
						</label>
						<label className="block">
							{kind === 'agent' ? 'Team' : 'Project'}
							<select name="parent" required className="input-field mt-1">
								<option value="">Select...</option>
								{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
							</select>
						</label>
						{kind === 'agent' ? (
							<>
								<label className="block">
									Model
									<select name="configuredModel" required className="input-field mt-1">
										<option value="">Select configured model...</option>
										{configuredModels.map((model) => (
											<option key={model.id} value={model.id}>
												{model.name} ({model.gatewayName} / {model.modelId})
											</option>
										))}
									</select>
									{configuredModels.length === 0 && (
										<span className="text-xs text-slate-400 mt-1 block">Configure models in the Models tab first.</span>
									)}
								</label>
								<label className="block">
									Role Group
									<select name="roleGroup" className="input-field mt-1">
										<option value="">No role group</option>
										{roleGroups.map((group) => (
											<option key={group.id} value={group.id}>{group.name}</option>
										))}
									</select>
								</label>
							</>
						) : (
							<label className="block">
								Goal
								<textarea name="goal" className="input-field mt-1" rows={3} />
							</label>
						)}
						{error && <p role="alert" style={{ color: 'var(--error)' }}>{error}</p>}
						<div className="flex items-center gap-3 pt-2">
							<button type="submit" disabled={busy} className="btn-primary">{busy ? 'Saving...' : 'Create'}</button>
							<button type="button" disabled={busy} onClick={() => setOpen(false)} className="btn-secondary">Cancel</button>
						</div>
					</form>
				</div>
			)}
		</>
	);
}
