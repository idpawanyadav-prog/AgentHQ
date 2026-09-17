import React, { useEffect, useState } from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api-client';
import type { ConfiguredModel, Gateway, RoleGroup } from '@/types';
import { FaCheck, FaComments, FaDownload, FaEdit, FaMicrochip, FaPaperPlane, FaPlug, FaPlus, FaSave, FaSpinner, FaTimes, FaTrash } from 'react-icons/fa';

const PROVIDER_COLORS: Record<string, { bg: string; text: string }> = {
	anthropic: { bg: 'bg-purple-400/10', text: 'text-purple-400' },
	openai: { bg: 'bg-green-400/10', text: 'text-green-400' },
	custom: { bg: 'bg-teal-400/10', text: 'text-teal-400' },
};

const emptyForm = {
	name: '',
	gatewayId: '',
	modelId: '',
	roleId: '',
};

type TestResult = {
	loading: boolean;
	success: boolean | null;
	message: string;
};

type ChatMessage = {
	role: 'user' | 'assistant';
	content: string;
};

export default function ModelsPage() {
	const [models, setModels] = useState<ConfiguredModel[]>([]);
	const [gateways, setGateways] = useState<Gateway[]>([]);
	const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
	const [form, setForm] = useState(emptyForm);
	const [editingId, setEditingId] = useState<string | null>(null);
	const [modelOptions, setModelOptions] = useState<string[]>([]);
	const [loading, setLoading] = useState(true);
	const [fetchingModels, setFetchingModels] = useState(false);
	const [saving, setSaving] = useState(false);
	const [testResults, setTestResults] = useState<Record<string, TestResult>>({});
	const [openChatModelId, setOpenChatModelId] = useState<string | null>(null);
	const [chatDrafts, setChatDrafts] = useState<Record<string, string>>({});
	const [chatMessages, setChatMessages] = useState<Record<string, ChatMessage[]>>({});
	const [chatLoading, setChatLoading] = useState<Record<string, boolean>>({});
	const [chatErrors, setChatErrors] = useState<Record<string, string>>({});
	const [error, setError] = useState('');
	const [message, setMessage] = useState('');

	const selectedGateway = gateways.find((gateway) => gateway.id === form.gatewayId);

	const load = async () => {
		setLoading(true);
		setError('');
		try {
			const [modelData, gatewayResponse, roleData] = await Promise.all([
				api.getModels(),
				fetch('/api/gateways').then((res) => {
					if (!res.ok) throw new Error('Unable to load gateways');
					return res.json();
				}),
				fetch('/api/agent-memory').then((res) => {
					if (!res.ok) return [];
					return res.json().then((data: any) => (Array.isArray(data) ? data : data.roleGroups || []));
				}).catch(() => []),
			]);
			setModels(Array.isArray(modelData) ? modelData : []);
			setGateways(Array.isArray(gatewayResponse.gateways) ? gatewayResponse.gateways : []);
			setRoleGroups(Array.isArray(roleData) ? roleData : []);
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to load models');
		} finally {
			setLoading(false);
		}
	};

	useEffect(() => {
		load();
	}, []);

	const loadModelOptionsForGateway = async (gateway: Gateway, preferredModelId = '') => {
		setFetchingModels(true);
		setError('');
		setMessage('');
		try {
			const response = await fetch('/api/gateway/models', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ gatewayId: gateway.id, provider: gateway.provider }),
			});
			const data = await response.json();
			if (!data.success) {
				setModelOptions([]);
				setForm((prev) => prev.gatewayId === gateway.id ? { ...prev, modelId: '' } : prev);
				setError(data.message || 'Failed to fetch model list');
				return;
			}
			const ids = data.success && Array.isArray(data.models)
				? data.models.map((model: { id: string }) => model.id)
				: [];
			const nextOptions = ids;
			setModelOptions(nextOptions);
			setForm((prev) => {
				if (prev.gatewayId !== gateway.id) return prev;
				const nextModelId =
					(preferredModelId && nextOptions.includes(preferredModelId) && preferredModelId) ||
					(prev.modelId && nextOptions.includes(prev.modelId) && prev.modelId) ||
					nextOptions[0] ||
					'';
				return { ...prev, modelId: nextModelId };
			});
			setMessage(nextOptions.length > 0 ? `Loaded ${nextOptions.length} model${nextOptions.length === 1 ? '' : 's'}` : 'No models returned for this gateway');
		} catch (err) {
			setError(err instanceof Error ? err.message : 'Failed to fetch model list');
		} finally {
			setFetchingModels(false);
		}
	};

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
		await loadModelOptionsForGateway(selectedGateway);
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
			roleId: form.roleId || undefined,
			roleName: form.roleId ? roleGroups.find((r) => r.id === form.roleId)?.name : undefined,
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
		setForm({ name: model.name, gatewayId: model.gatewayId, modelId: model.modelId, roleId: model.roleId || '' });
		setModelOptions([model.modelId]);
		setError('');
		setMessage('');
		const gateway = gateways.find((item) => item.id === model.gatewayId);
		if (gateway) void loadModelOptionsForGateway(gateway, model.modelId);
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

	const testModelConnection = async (model: ConfiguredModel) => {
		const gateway = gateways.find((item) => item.id === model.gatewayId);
		if (!gateway) {
			setTestResults((prev) => ({
				...prev,
				[model.id]: { loading: false, success: false, message: 'Gateway not found' },
			}));
			return;
		}
		setTestResults((prev) => ({
			...prev,
			[model.id]: { loading: true, success: null, message: 'Testing...' },
		}));
		try {
			const response = await fetch('/api/gateway/test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					gatewayId: gateway.id,
					provider: model.provider,
					model: model.modelId,
				}),
			});
			const data = await response.json();
			setTestResults((prev) => ({
				...prev,
				[model.id]: {
					loading: false,
					success: Boolean(data.success),
					message: data.message || (data.success ? 'Connection successful' : 'Connection failed'),
				},
			}));
		} catch (err) {
			setTestResults((prev) => ({
				...prev,
				[model.id]: { loading: false, success: false, message: err instanceof Error ? err.message : 'Connection test failed' },
			}));
		}
	};

	const sendModelChat = async (model: ConfiguredModel) => {
		const text = (chatDrafts[model.id] || '').trim();
		if (!text) return;
		const gateway = gateways.find((item) => item.id === model.gatewayId);
		if (!gateway) {
			setChatErrors((prev) => ({ ...prev, [model.id]: 'Gateway not found' }));
			return;
		}
		const history = chatMessages[model.id] || [];
		setChatMessages((prev) => ({
			...prev,
			[model.id]: [...(prev[model.id] || []), { role: 'user', content: text }],
		}));
		setChatDrafts((prev) => ({ ...prev, [model.id]: '' }));
		setChatErrors((prev) => ({ ...prev, [model.id]: '' }));
		setChatLoading((prev) => ({ ...prev, [model.id]: true }));
		try {
			const response = await fetch('/api/gateway/chat-test', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					gatewayId: gateway.id,
					provider: model.provider,
					model: model.modelId,
					message: text,
					history,
				}),
			});
			const data = await response.json();
			if (!data.success) throw new Error(data.message || data.error || 'Model chat failed');
			setChatMessages((prev) => ({
				...prev,
				[model.id]: [...(prev[model.id] || []), { role: 'assistant', content: data.reply }],
			}));
		} catch (err) {
			setChatErrors((prev) => ({ ...prev, [model.id]: err instanceof Error ? err.message : 'Model chat failed' }));
		} finally {
			setChatLoading((prev) => ({ ...prev, [model.id]: false }));
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
									if (gateway) void loadModelOptionsForGateway(gateway);
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

					{roleGroups.length > 0 && (
					<label className="block">
						Role:
						<select
							value={form.roleId}
							onChange={(event) => setForm((prev) => ({ ...prev, roleId: event.target.value }))}
							className="input-field mt-1"
						>
							<option value="">None (global)</option>
							{roleGroups.map((group) => (
								<option key={group.id} value={group.id}>{group.name}</option>
							))}
						</select>
					</label>
					)}

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
							const test = testResults[model.id];
							const chatOpen = openChatModelId === model.id;
							const activeMessages = chatMessages[model.id] || [];
							const chatBusy = Boolean(chatLoading[model.id]);
							const chatError = chatErrors[model.id];
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
									<div className="mt-3 flex flex-col gap-2 border-t border-[var(--border-default)] pt-3">
										<div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
											<button
												type="button"
												onClick={() => testModelConnection(model)}
												disabled={test?.loading}
												className="btn-secondary inline-flex items-center justify-center gap-2 text-xs disabled:cursor-not-allowed disabled:opacity-60"
											>
												{test?.loading ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaPlug className="h-3.5 w-3.5" />}
												{test?.loading ? 'Testing...' : 'Test Connection'}
											</button>
											<button
												type="button"
												onClick={() => setOpenChatModelId(chatOpen ? null : model.id)}
												className="btn-secondary inline-flex items-center justify-center gap-2 text-xs"
											>
												<FaComments className="h-3.5 w-3.5" />
												{chatOpen ? 'Close Chat' : 'Chat Test'}
											</button>
										</div>
										{test && !test.loading && (
											<p className={"flex items-start gap-1.5 text-xs " + (test.success ? "text-emerald-400" : "text-red-400")}>
												{test.success ? <FaCheck className="mt-0.5 h-3 w-3 flex-none" /> : <FaTimes className="mt-0.5 h-3 w-3 flex-none" />}
												<span>{test.message}</span>
											</p>
										)}
										{chatOpen && (
											<div className="mt-2 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/60 p-3">
												<div className="max-h-52 overflow-y-auto space-y-2 pr-1">
													{activeMessages.length === 0 ? (
														<p className="text-xs text-[var(--text-tertiary)]">Send a prompt to confirm this model can really answer.</p>
													) : activeMessages.map((item, index) => (
														<div
															key={`${model.id}-chat-${index}`}
															className={`rounded-md px-3 py-2 text-xs leading-relaxed ${item.role === 'user' ? 'ml-6 bg-blue-500/15 text-blue-100' : 'mr-6 bg-[var(--bg-primary)] text-[var(--text-secondary)]'}`}
														>
															<p className="mb-1 font-medium uppercase tracking-wide text-[10px] text-[var(--text-tertiary)]">
																{item.role === 'user' ? 'You' : model.name}
															</p>
															<p className="whitespace-pre-wrap">{item.content}</p>
														</div>
													))}
													{chatBusy && <p className="text-xs text-[var(--text-tertiary)]">Waiting for reply...</p>}
												</div>
												{chatError && <p role="alert" className="mt-2 text-xs text-red-400">{chatError}</p>}
												<div className="mt-3 grid grid-cols-[1fr_auto] gap-2">
													<textarea
														value={chatDrafts[model.id] || ''}
														onChange={(event) => setChatDrafts((prev) => ({ ...prev, [model.id]: event.target.value }))}
														onKeyDown={(event) => {
															if (event.key === 'Enter' && !event.shiftKey) {
																event.preventDefault();
																void sendModelChat(model);
															}
														}}
														disabled={chatBusy}
														rows={2}
														className="input-field resize-none text-sm"
														placeholder="Ask this model something..."
													/>
													<button
														type="button"
														onClick={() => sendModelChat(model)}
														disabled={chatBusy || !(chatDrafts[model.id] || '').trim()}
														className="btn-primary inline-flex h-full min-w-12 items-center justify-center disabled:cursor-not-allowed disabled:opacity-60"
														title="Send test message"
													>
														{chatBusy ? <FaSpinner className="h-3.5 w-3.5 animate-spin" /> : <FaPaperPlane className="h-3.5 w-3.5" />}
													</button>
												</div>
											</div>
										)}
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
