import React, { useState, useEffect } from "react";
import { useRouter } from "next/router";
import type { Gateway, GatewayProvider, StoredSettings } from "@/types";
import Layout from "@/components/Layout";
import api from "@/lib/api-client";
import {
 FaKey,
 FaBolt,
 FaEye,
 FaEyeSlash,
 FaPlug,
 FaSpinner,
 FaCheck,
 FaTimes,
 FaPlus,
 FaTrash,
 FaEdit,
 FaStar,
 FaRobot,
 FaGlobe,
 FaCog,
 FaDownload,
} from "react-icons/fa";

const STORAGE_KEY = "agent-office-settings";

const PROVIDER_LABELS: Record<GatewayProvider, string> = {
 anthropic: "Anthropic (Claude)",
 openai: "OpenAI (GPT)",
 custom: "Custom / OpenAI-Compatible",
};

const PROVIDER_COLORS: Record<GatewayProvider, string> = {
 anthropic: "text-purple-400 bg-purple-400/10 border-purple-400/30",
 openai: "text-green-400 bg-green-400/10 border-green-400/30",
 custom: "text-blue-400 bg-blue-400/10 border-blue-400/30",
};

const PROVIDER_ICONS: Record<GatewayProvider, React.ReactNode> = {
 anthropic: <FaRobot className="w-3.5 h-3.5" />,
 openai: <FaBolt className="w-3.5 h-3.5" />,
 custom: <FaGlobe className="w-3.5 h-3.5" />,
};

const DEFAULT_MODELS: Record<GatewayProvider, string> = {
 anthropic: "claude-sonnet-4-5",
 openai: "gpt-4o",
 custom: "gpt-4o",
};

const generateId = () => `gw-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

interface ConnectionResult {
 loading: boolean;
 success: boolean | null;
 message: string;
}

interface GatewayFormData {
 name: string;
 provider: GatewayProvider;
 baseUrl: string;
 apiKey: string;
 model: string;
}

const emptyForm: GatewayFormData = {
 name: "",
 provider: "custom",
 baseUrl: "",
 apiKey: "",
 model: "gpt-4o",
};

export default function SettingsPage() {
	const router = useRouter();
	const [gateways, setGateways] = useState<Gateway[]>([]);
 const [defaultGatewayId, setDefaultGatewayId] = useState<string>("");
 const [rateLimit, setRateLimit] = useState("30");
 const [saved, setSaved] = useState(false);

 const [editingId, setEditingId] = useState<string | null>(null);
 const [form, setForm] = useState<GatewayFormData>(emptyForm);
 const [showForm, setShowForm] = useState(false);

 const [testResults, setTestResults] = useState<Record<string, ConnectionResult>>({});
 const [showKeys, setShowKeys] = useState<Record<string, boolean>>({});
 const [modelOptions, setModelOptions] = useState<Record<string, string[]>>({});
 const [loadingModels, setLoadingModels] = useState<Record<string, boolean>>({});

 const handleNavigate = (item: string) => {
 const navHref: Record<string, string> = {
 overview: "/",
 teams: "/teams",
 tasks: "/tasks",
 agents: "/agents",
 projects: "/projects",
 activity: "/activity",
 settings: "/settings",
 sprints: "/sprints",
 };
 router.push(navHref[item] || "/");
 };

 useEffect(() => {
  (async () => {
   try {
    const r = await fetch('/api/gateways'); if(!r.ok) throw new Error('Unable to load gateways');
    let data = await r.json();
    const legacy = localStorage.getItem(STORAGE_KEY);
    if (!data.gateways.length && legacy) {
     const old = JSON.parse(legacy);
     if(old.gateways?.length) {
      const migration = await fetch('/api/gateways',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({gateways:old.gateways,defaultGatewayId:old.defaultGatewayId || old.gateways[0].id})});
      if(!migration.ok) throw new Error('Unable to migrate saved gateways');
      data = await (await fetch('/api/gateways')).json();localStorage.removeItem(STORAGE_KEY);
     }
    }
    setGateways(data.gateways); setDefaultGatewayId(data.defaultGatewayId);
    const remote = await api.getSettings(); if(remote.ai_rate_limit_max) setRateLimit(remote.ai_rate_limit_max);
   } catch(e) { setSaveError((e as Error).message); }
  })();
 }, []);
 const [saveError, setSaveError] = useState('');
 const persist = async (gws: Gateway[], defaultId: string) => {
  setSaved(false); setSaveError('');
  try {
   const r = await fetch('/api/gateways', {method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({gateways:gws,defaultGatewayId:defaultId})});
   if(!r.ok) throw new Error((await r.json()).error || 'Unable to save gateways');
   await api.updateSettings({ai_rate_limit_max:rateLimit});
   const refreshed = await fetch('/api/gateways');
   if(!refreshed.ok) throw new Error('Saved, but unable to refresh gateways');
   const data = await refreshed.json(); setGateways(data.gateways); setDefaultGatewayId(data.defaultGatewayId);
   localStorage.removeItem(STORAGE_KEY);
   setSaved(true); setTimeout(() => setSaved(false), 3000);
  } catch(e) { setSaveError((e as Error).message); }
 };

 const handleMainSave = (e: React.FormEvent) => {
 e.preventDefault();
 persist(gateways, defaultGatewayId);
 };

 const openAddForm = () => {
 setEditingId(null);
 setForm(emptyForm);
 setShowForm(true);
 };

 const openEditForm = (gw: Gateway) => {
 setEditingId(gw.id);
 setForm({
 name: gw.name,
 provider: gw.provider,
 baseUrl: gw.baseUrl,
 apiKey: gw.apiKey,
 model: gw.model,
 });
 setShowForm(true);
 };

 const handleFormSubmit = (e: React.FormEvent) => {
 e.preventDefault();
 if (!form.name || !form.baseUrl || !form.apiKey || !form.model) {
 return;
 }

 let next: Gateway[];
 let nextDefault = defaultGatewayId;

 if (editingId) {
 next = gateways.map((gw) => (gw.id === editingId ? { ...gw, ...form } : gw));
 } else {
 const newGw: Gateway = {
 id: generateId(),
 ...form,
 createdAt: new Date().toISOString(),
 };
 next = [...gateways, newGw];
 if (!defaultGatewayId && gateways.length === 0) {
 nextDefault = newGw.id;
 }
 }

 setGateways(next);
 if (!defaultGatewayId && gateways.length === 0 && next.length > 0) {
 setDefaultGatewayId(next[0].id);
 }
 persist(next, nextDefault || defaultGatewayId);
 setShowForm(false);
 setEditingId(null);
 setForm(emptyForm);
 };

 const handleDelete = (id: string) => {
 const next = gateways.filter((gw) => gw.id !== id);
 let nextDefault = defaultGatewayId;
 if (defaultGatewayId === id) {
 nextDefault = next.length > 0 ? next[0].id : "";
 setDefaultGatewayId(nextDefault);
 }
 setGateways(next);
 persist(next, nextDefault);
 };

 const handleSetDefault = (id: string) => {
 setDefaultGatewayId(id);
 persist(gateways, id);
 };

 const toggleKeyVisibility = (id: string) => {
 setShowKeys((prev) => ({ ...prev, [id]: !prev[id] }));
 };

 const testGatewayConnection = async (gw: Gateway) => {
 setTestResults((prev) => ({
 ...prev,
 [gw.id]: { loading: true, success: null, message: "" },
 }));

 try {
 const response = await fetch("/api/gateway/test", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 baseUrl: gw.baseUrl,
 apiKey: gw.apiKey,
 gatewayId: gw.id,
 model: gw.model,
 provider: gw.provider,
 }),
 });

 const data = await response.json();

 if (data.success) {
 setTestResults((prev) => ({
 ...prev,
 [gw.id]: { loading: false, success: true, message: data.message },
 }));
 } else {
 setTestResults((prev) => ({
 ...prev,
 [gw.id]: { loading: false, success: false, message: data.message },
 }));
 }
 } catch (err: any) {
 setTestResults((prev) => ({
 ...prev,
 [gw.id]: { loading: false, success: false, message: `Error: ${err.message}` },
 }));
 }
 };

 const renderTestResult = (gwId: string) => {
 const r = testResults[gwId];
 if (!r || (r.success === null && !r.loading)) return null;
 if (r.loading) {
 return (
 <span className="flex items-center gap-1 text-xs text-slate-400">
 <FaSpinner className="w-3 h-3 animate-spin" />
 Testing...
 </span>
 );
 }
 if (r.success) {
 return (
 <span className="flex items-center gap-1 text-xs text-green-400">
 <FaCheck className="w-3 h-3" />
 {r.message}
 </span>
 );
 }
 return (
 <span className="flex items-center gap-1 text-xs text-red-400">
 <FaTimes className="w-3 h-3" />
 {r.message}
 </span>
 );
 };

 const fetchModelsForForm = async () => {
 if (!form.baseUrl || !form.apiKey) return;
 setLoadingModels((prev) => ({ ...prev, __form__: true }));
 try {
 const response = await fetch("/api/gateway/models", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 baseUrl: form.baseUrl,
 apiKey: form.apiKey,
 gatewayId: editingId,
 provider: form.provider,
 }),
 });
 const data = await response.json();
 if (data.success && data.models && data.models.length > 0) {
 const ids = data.models.map((m: any) => m.id);
 setModelOptions((prev) => ({ ...prev, __form__: ids }));
 if (!ids.includes(form.model)) {
 setForm((prev) => ({ ...prev, model: ids[0] }));
 }
 } else {
 setModelOptions((prev) => ({ ...prev, __form__: [] }));
 }
 } catch {
 setModelOptions((prev) => ({ ...prev, __form__: [] }));
 } finally {
 setLoadingModels((prev) => ({ ...prev, __form__: false }));
 }
 };

 const fetchModelsForGateway = async (gw: Gateway) => {
 setLoadingModels((prev) => ({ ...prev, [gw.id]: true }));
 try {
 const response = await fetch("/api/gateway/models", {
 method: "POST",
 headers: { "Content-Type": "application/json" },
 body: JSON.stringify({
 baseUrl: gw.baseUrl,
 apiKey: gw.apiKey,
 gatewayId: gw.id,
 provider: gw.provider,
 }),
 });
 const data = await response.json();
 if (data.success && data.models && data.models.length > 0) {
 const ids = data.models.map((m: any) => m.id);
 setModelOptions((prev) => ({ ...prev, [gw.id]: ids }));
 } else {
 setModelOptions((prev) => ({ ...prev, [gw.id]: [] }));
 }
 } catch {
 setModelOptions((prev) => ({ ...prev, [gw.id]: [] }));
 } finally {
 setLoadingModels((prev) => ({ ...prev, [gw.id]: false }));
 }
 };

 return (
 <Layout activeNav="settings" onNavigate={handleNavigate}>
 {saveError && <p role="alert" className="text-red-400">{saveError}</p>}
 <div className="px-6 space-y-6">
 <h1 className="text-3xl font-bold text-white mb-2">Settings</h1>
 <p className="text-slate-400 mb-8">Configure your AI providers, gateways, and platform settings.</p>

 {/* Gateway section — completely separate form from the main save form */}
 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-6 mb-8">
 <div className="flex items-center justify-between mb-4">
 <h2 className="text-xl font-semibold text-white flex items-center gap-2">
 <FaGlobe className="text-blue-400" />
 Gateways
 </h2>
 <button
 type="button"
 onClick={openAddForm}
 className="text-xs px-3 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1 transition-colors"
 >
 <FaPlus className="w-3 h-3" />
 Add Gateway
 </button>
 </div>
 <p className="text-slate-400 text-sm mb-4">
 Add named gateway credentials with their own Base URL and API key. Each gateway can point to a different provider endpoint (Anthropic, OpenAI, or any OpenAI-compatible proxy like Brocode).
 </p>

 {gateways.length === 0 && !showForm && (
 <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-slate-700 rounded-lg">
 No gateways configured. Add one to get started.
 </div>
 )}

 {/* Gateway list */}
 <div className="space-y-3">
 {gateways.map((gw) => {
 const isDefault = gw.id === defaultGatewayId;
 const providerColor = PROVIDER_COLORS[gw.provider];

 return (
 <div
 key={gw.id}
 className={"bg-[#111827] rounded-lg p-4 border " + (isDefault ? "border-blue-400/50" : "border-slate-700")}
 >
 <div className="flex items-start justify-between mb-2">
 <div className="flex items-center gap-2">
 <span className={"text-xs px-2 py-0.5 rounded-full border flex items-center gap-1 " + providerColor}>
 {PROVIDER_ICONS[gw.provider]}
 {PROVIDER_LABELS[gw.provider]}
 </span>
 {isDefault && (
 <span className="text-xs px-2 py-0.5 rounded-full bg-blue-400/10 text-blue-400 flex items-center gap-1">
 <FaStar className="w-3 h-3" />
 Default
 </span>
 )}
 </div>
 <div className="flex items-center gap-1">
 <button
 type="button"
 onClick={() => openEditForm(gw)}
 className="text-slate-400 hover:text-white p-1"
 title="Edit"
 >
 <FaEdit className="w-3.5 h-3.5" />
 </button>
 <button
 type="button"
 onClick={() => handleDelete(gw.id)}
 className="text-slate-400 hover:text-red-400 p-1"
 title="Delete"
 >
 <FaTrash className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>

 <h3 className="text-sm font-medium text-white mb-1">{gw.name}</h3>
 <p className="text-xs text-slate-500 mb-1 font-mono break-all">{gw.baseUrl}</p>
 <p className="text-xs text-slate-500 mb-2">Model: {gw.model}</p>

 <div className="flex items-center gap-2 mb-2">
 <span className="text-xs text-slate-500 font-mono">
 Key: {showKeys[gw.id] ? gw.apiKey : gw.apiKey.slice(0, 4) + "****" + (gw.apiKey.length > 8 ? gw.apiKey.slice(-4) : "")}
 </span>
 <button
 type="button"
 onClick={() => toggleKeyVisibility(gw.id)}
 className="text-slate-400 hover:text-white"
 >
 {showKeys[gw.id] ? <FaEyeSlash className="w-3 h-3" /> : <FaEye className="w-3 h-3" />}
 </button>
 </div>

 {renderTestResult(gw.id)}

 <div className="flex items-center gap-2 mt-3">
 <button
 type="button"
 onClick={() => testGatewayConnection(gw)}
 disabled={!gw.apiKey || !gw.baseUrl || testResults[gw.id]?.loading}
 className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-[#111827] disabled:text-slate-500 text-white flex items-center gap-1 transition-colors"
 >
 <FaPlug className="w-3 h-3" />
 Test Connection
 </button>
 <button
 type="button"
 onClick={() => fetchModelsForGateway(gw)}
 disabled={loadingModels[gw.id] || !gw.apiKey || !gw.baseUrl}
 className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-[#111827] disabled:text-slate-500 text-white flex items-center gap-1 transition-colors"
 >
 {loadingModels[gw.id] ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FaDownload className="w-3 h-3" />}
 {loadingModels[gw.id] ? "Loading..." : modelOptions[gw.id]?.length > 0 ? "Models: " + modelOptions[gw.id].length : "Fetch Models"}
 </button>
 {!isDefault && (
 <button
 type="button"
 onClick={() => handleSetDefault(gw.id)}
 className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white flex items-center gap-1 transition-colors"
 >
 <FaStar className="w-3 h-3" />
 Set as Default
 </button>
 )}
 </div>
 </div>
 );
 })}
 </div>

 {/* Add/Edit form — separate form element so it doesn't submit the outer form */}
 {showForm && (
 <form onSubmit={handleFormSubmit} className="mt-4 bg-[#1a1d2e] border border-slate-600 rounded-lg p-4 space-y-3">
 <h3 className="text-sm font-medium text-white">{editingId ? "Edit Gateway" : "New Gateway"}</h3>
 <div>
 <label className="block text-slate-300 text-xs font-medium mb-1">Name</label>
 <input
 type="text"
 value={form.name}
 onChange={(e) => setForm({ ...form, name: e.target.value })}
 placeholder="My Claude Proxy"
 required
 className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
 />
 </div>
 <div>
 <label className="block text-slate-300 text-xs font-medium mb-1">Provider</label>
 <select
 value={form.provider}
 onChange={(e) => setForm({ ...form, provider: e.target.value as GatewayProvider, model: DEFAULT_MODELS[e.target.value as GatewayProvider] })}
 className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500"
 >
 <option value="anthropic">Anthropic (Claude)</option>
 <option value="openai">OpenAI (GPT)</option>
 <option value="custom">Custom / OpenAI-Compatible</option>
 </select>
 </div>
 <div>
 <label className="block text-slate-300 text-xs font-medium mb-1">Base URL</label>
 <input
 type="url"
 value={form.baseUrl}
 onChange={(e) => setForm({ ...form, baseUrl: e.target.value })}
 placeholder="https://api.brocode.live"
 required
 className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
 />
 <p className="text-slate-500 text-xs mt-0.5">Full API endpoint. Supports proxies like Brocode, , etc.</p>
 </div>
 <div>
 <label className="block text-slate-300 text-xs font-medium mb-1">API Key</label>
 <div className="relative">
 <input
 type={showKeys["__form__"] ? "text" : "password"}
 value={form.apiKey}
 onChange={(e) => setForm({ ...form, apiKey: e.target.value })}
 placeholder="sk-..."
 required
 className="w-full bg-[#111827] border border-slate-700 rounded-lg px-3 py-1.5 pr-10 text-white text-sm placeholder-slate-500 focus:outline-none focus:border-blue-500"
 />
 <button
 type="button"
 onClick={() => setShowKeys((prev) => ({ ...prev, __form__: !prev.__form__ }))}
 className="absolute right-2 top-1.5 text-slate-400 hover:text-white"
 >
 {showKeys["__form__"] ? <FaEyeSlash className="w-3.5 h-3.5" /> : <FaEye className="w-3.5 h-3.5" />}
 </button>
 </div>
 </div>
 <div>
 <label className="block text-slate-300 text-xs font-medium mb-1">Model</label>
 <div className="flex items-center gap-2">
 <select
 value={form.model}
 onChange={(e) => setForm({ ...form, model: e.target.value })}
 disabled={modelOptions["__form__"]?.length > 0}
 className="flex-1 bg-[#111827] border border-slate-700 rounded-lg px-3 py-1.5 text-white text-sm focus:outline-none focus:border-blue-500 disabled:bg-[#111827] disabled:text-slate-400"
 >
 {modelOptions["__form__"]?.length > 0 ? (
 modelOptions["__form__"].map((id) => (
 <option key={id} value={id}>{id}</option>
 ))
 ) : (
 <option value="">{form.model || "gpt-4o"}</option>
 )}
 </select>
 <button
 type="button"
 onClick={fetchModelsForForm}
 disabled={loadingModels["__form__"] || !form.baseUrl || !form.apiKey}
 className="text-xs px-3 py-1.5 rounded bg-slate-700 hover:bg-slate-600 disabled:bg-[#111827] disabled:text-slate-500 text-white flex items-center gap-1 transition-colors whitespace-nowrap"
 >
 {loadingModels["__form__"] ? <FaSpinner className="w-3 h-3 animate-spin" /> : <FaDownload className="w-3 h-3" />}
 {loadingModels["__form__"] ? "..." : "Fetch"}
 </button>
 </div>
 </div>
 <div className="flex items-center gap-2 pt-1">
 <button
 type="submit"
 className="text-xs px-4 py-1.5 rounded bg-blue-600 hover:bg-blue-500 text-white transition-colors"
 >
 {editingId ? "Update Gateway" : "Add Gateway"}
 </button>
 <button
 type="button"
 onClick={() => { setShowForm(false); setEditingId(null); setForm(emptyForm); }}
 className="text-xs px-4 py-1.5 rounded bg-slate-700 hover:bg-slate-600 text-white transition-colors"
 >
 Cancel
 </button>
 </div>
 </form>
 )}
 </div>

 {/* Platform settings — inside a separate <form> so the Save button works */}
 <form onSubmit={handleMainSave} className="space-y-8">
 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-6">
 <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
 <FaCog className="text-blue-400" />
 Platform Settings
 </h2>
 <div className="space-y-4">
 <div>
 <label className="block text-slate-300 text-sm font-medium mb-2">AI Rate Limit (requests per minute)</label>
 <input
 type="number"
 value={rateLimit}
 onChange={(e) => setRateLimit(e.target.value)}
 min="1"
 max="200"
 className="w-full bg-[#111827] border border-slate-700 rounded-lg px-4 py-2 text-white focus:outline-none focus:border-blue-500"
 />
 </div>
 </div>
 </div>

 {/* GitHub */}
 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-6">
 <h2 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
 <FaKey className="text-green-400" />
 GitHub Integration
 </h2>
 <p className="text-slate-400 text-sm mb-4">
 Connect your GitHub account to enable repository access and webhooks.
 </p>
 <button
 type="button"
 className="bg-slate-700 hover:bg-slate-600 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors"
 >
 Connect GitHub Account
 </button>
 </div>

 {/* Save Button */}
 <button
 type="submit"
 className="w-full bg-blue-600 hover:bg-blue-500 text-white py-3 rounded-lg font-medium transition-colors"
 >
 {saved ? "Saved!" : "Save Settings"}
 </button>
 </form>
 </div>
 </Layout>
 );
}
