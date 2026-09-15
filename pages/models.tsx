import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api-client';
import type { ConfiguredModel, Gateway } from '@/types';
import { FaDownload, FaEdit, FaMicrochip, FaPlus, FaSave, FaTrash } from 'react-icons/fa';

const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
	anthropic: { bg: 'bg-purple-400/10', text: 'text-purple-400' },
	openai: { bg: 'bg-green-400/10', text: 'text-green-400' },
	custom: { bg: 'bg-teal-400/10', text: 'text-teal-400' },
};

const emptyForm = {
	name: '',
	gatewayId: '',
	modelId: '',
};

export default function ModelsPage() {
	const [models, setModels] = useState<ConfiguredModel[]>([]);
	const [gateways, setGateways] = useState<Gateway[]>([]);
	const [form, setForm] = useState(emptyForm);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [modelOptions, setModelOptions] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [fetchingModels, setFetchingModels] = useState(false);
	const [saving, setSaving] = useState(false);
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');

	const selectedGateway = gateways.find((gateway) => gateway.id === form.gatewayId);

	const load = async () => {
		setLoading(true);
		setError('');
		try {
			const [modelData, gatewayResponse] = await Promise.all([
				api.getModels(),
				fetch('/api/gateways').then((res) => {
					if (!res.ok) throw new Error('Unable to load gateways');
					return res.json();
				}),
			]);
			setModels(Array.isArray(modelData) ? modelData : []);
			setGateways(Array.isArray(gatewayResponse.gateways) ? gatewayResponse.gateways : []);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load models');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const resetForm = () => {
		setForm(emptyForm);
		setEditingId(null);
		setModelOptions([]);
		setMessage('');
	};

	const fetchModelsForGateway = async () => {
		if (!selectedGateway) {
			setError('Select a gateway first');
			return;
		}
		setFetchingModels(true);
		setError('');
		setMessage('');
		try {
			const response = await fetch('/api/gateway/models', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gatewayId: selectedGateway.id, provider: selectedGateway.provider }),
			});
			const data = await response.json();
			const ids = data.success && Array.isArray(data.models)
				? data.models.map((model: { id: string }) => model.id)
				: [];
			const nextOptions = ids.length > 0 ? ids : selectedGateway.model ? [selectedGateway.model] : [];
			setModelOptions(nextOptions);
			setForm((prev) => ({
				...prev,
				modelId: nextOptions.includes(prev.modelId) ? prev.modelId : nextOptions[0] || '',
			}));
			setMessage(nextOptions.length > 0 ? 'Model list updated' : 'No models returned for this gateway');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch model list');
		} finally {
			setFetchingModels(false);
		}
	};

	const saveModel = async (event: React.FormEvent) => {
		event.preventDefault();
		if (!selectedGateway) {
			setError('Select a gateway');
			return;
		}
		if (!form.modelId) {
			setError('Select a model');
			return;
		}
		setSaving(true);
		setError('');
		setMessage('');
		const payload = {
			name: form.name.trim(),
			gatewayId: selectedGateway.id,
			gatewayName: selectedGateway.name,
			provider: selectedGateway.provider,
			modelId: form.modelId,
		};
		try {
			if (editingId) {
				await api.updateModel(editingId, payload);
				setMessage('Model updated');
			} else {
				await api.createModel(payload);
				setMessage('Model added');
			}
			resetForm();
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to save model');
		} finally {
			setSaving(false);
		}
	};

	const editModel = (model: ConfiguredModel) => {
		setEditingId(model.id);
		setForm({ name: model.name, gatewayId: model.gatewayId, modelId: model.modelId });
		setModelOptions([model.modelId]);
		setError('');
		setMessage('');
	};

	const deleteModel = async (model: ConfiguredModel) => {
		if (!window.confirm(`Delete model "${model.name}"?`)) return;
		setError('');
		setMessage('');
		try {
			await api.deleteModel(model.id);
			setMessage('Model deleted');
			await load();
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to delete model');
		}
	};

	return (
		<Layout activeNav="models">
			<div className="space-y-6 transition-colors duration-200">
				<div>
					<h1 className="text-2xl font-bold text-[var(--text-primary)]">Models</h1>
					<p className="text-sm text-[var(--text-secondary)] mt-1">
						Configure reusable models from saved gateway credentials.
					</p>
				</div>

				<form onSubmit={saveModel} className="page-panel space-y-4">
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						<label className="block">
							Model Name:
							<input
								value={form.name}
								onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
								required
								className="input-field mt-1"
								placeholder="e.g., Coding Agent"
							/>
						</label>
						<label className="block">
							Gateway Name:
							<select
								value={form.gatewayId}
								onChange={(event) => {
									const gatewayId = event.target.value;
									const gateway = gateways.find((item) => item.id === gatewayId);
									setForm((prev) => ({ ...prev, gatewayId, modelId: '' }));
									setModelOptions(gateway?.model ? [gateway.model] : []);
									setMessage('');
								}}
								required
								className="input-field mt-1"
							>
								<option value="">Select gateway...</option>
								{gateways.map((gateway) => (
									<option key={gateway.id} value={gateway.id}>{gateway.name}</option>
								))}
							</select>
						</label>
					</div>

					<div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-3 items-end">
						<label className="block">
							Select Model:
							<select
								value={form.modelId}
								onChange={(event) => setForm((prev) => ({ ...prev, modelId: event.target.value }))}
								required
								className="input-field mt-1"
							>
								<option value="">Select model...</option>
								{modelOptions.map((model) => (
									<option key={model} value={model}>{model}</option>
								))}
							</select>
						</label>
						<button
							type="button"
							onClick={fetchModelsForGateway}
							disabled={fetchingModels || !form.gatewayId}
							className="btn-secondary inline-flex items-center justify-center gap-2"
						>
							<FaDownload className="w-3.5 h-3.5" />
							{fetchingModels ? 'Fetching...' : 'Fetch Models'}
						</button>
					</div>

					{error && <p role="alert" className="text-sm text-red-400">{error}</p>}
					{message && <p className="text-sm text-emerald-400">{message}</p>}

					<div className="flex items-center gap-3">
						<button type="submit" disabled={saving} className="btn-primary inline-flex items-center gap-2">
							{editingId ? <FaSave className="w-3.5 h-3.5" /> : <FaPlus className="w-3.5 h-3.5" />}
							{saving ? 'Saving...' : editingId ? 'Update Model' : 'Add Model'}
						</button>
						{editingId && (
							<button type="button" onClick={resetForm} className="btn-secondary">Cancel Edit</button>
						)}
					</div>
				</form>

				{loading ? (
					<p className="text-[var(--text-secondary)]">Loading models...</p>
				) : models.length === 0 ? (
					<div className="page-panel text-center py-12">
						<p className="text-sm text-[var(--text-secondary)]">
							No configured models yet. Add one above.
						</p>
					</div>
				) : (
					<div className="grid grid-cols-1 md:grid-cols-2 gap-4">
						{models.map((model) => {
							const pc = PROVIDER_COLORS[model.provider] || PROVIDER_COLORS.anthropic;
							return (
								<div key={model.id} className="team-card">
									<div className="flex items-start justify-between gap-4 mb-3">
										<div className="flex items-center gap-3 min-w-0">
											<div className={`p-2 rounded-lg ${pc.bg}`}>
												<FaMicrochip className={`w-4 h-4 ${pc.text}`} />
											</div>
											<div className="min-w-0">
												<h3 className="text-base font-medium text-[var(--text-primary)] truncate">{model.name}</h3>
												<p className="text-xs text-[var(--text-secondary)] truncate">
													{model.gatewayName} &middot; {model.modelId}
												</p>
												<p className="text-xs text-[var(--text-tertiary)] mt-1">
													{model.assignments || 0} assigned agent{model.assignments === 1 ? '' : 's'}
												</p>
											</div>
										</div>
										<div className="flex items-center gap-2 flex-shrink-0">
											<button
												type="button"
												onClick={() => editModel(model)}
												title="Edit model"
												className="p-1.5 text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors"
											>
												<FaEdit className="w-3.5 h-3.5" />
											</button>
											<button
												type="button"
												onClick={() => deleteModel(model)}
												disabled={model.assignments > 0}
												title={model.assignments > 0 ? 'Cannot delete assigned model' : 'Delete model'}
												className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 disabled:opacity-40 disabled:cursor-not-allowed rounded-md transition-colors"
											>
												<FaTrash className="w-3.5 h-3.5" />
											</button>
										</div>
									</div>
									{(model.agentNames || []).length > 0 && (
										<div className="mt-3 pt-3 border-t border-[var(--border-default)]">
											<p className="text-xs text-[var(--text-tertiary)] mb-1">Used by agents:</p>
											<p className="text-xs text-[var(--text-secondary)]">{model.agentNames.join(', ')}</p>
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
