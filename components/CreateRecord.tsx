import React, { useState } from 'react';
import api from '@/lib/api-client';

export default function CreateRecord({ kind, onCreated }: { kind: 'agent' | 'sprint'; onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [options, setOptions] = useState<{ id: string; name: string }[]>([]);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);
  async function show() {
    setOpen(true); setError('');
    try {
      const data = kind === 'agent' ? (await api.getTeams()).flatMap((t: {members: {id:string;name:string}[]}) => t.members) : await api.getProjects();
      setOptions(data);
    } catch (e) { setError((e as Error).message); }
  }
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError('');
    const values = new FormData(e.currentTarget);
    try {
      const name = String(values.get('name')).trim();
      if (kind === 'agent') await api.createAgent({ name, memberId: String(values.get('parent')), type: String(values.get('provider')), model: String(values.get('model')).trim(), config: {} });
      else await api.createSprint({ name, projectId: String(values.get('parent')), goal: String(values.get('goal')) });
      setOpen(false); onCreated();
    } catch (e) { setError((e as Error).message); }
    finally { setBusy(false); }
  }
  return <><button type="button" onClick={show} className="px-3 py-2 bg-blue-600 rounded">{kind === 'agent' ? 'Add Agent' : 'New Sprint'}</button>
    {open && <div className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"><form onSubmit={submit} role="dialog" aria-modal="true" aria-label={`Create ${kind}`} className="bg-slate-900 p-6 rounded-lg w-full max-w-md space-y-4">
      <h2 className="text-xl">Create {kind}</h2>
      <label className="block">Name<input name="name" required className="input-dark w-full" /></label>
      <label className="block">{kind === 'agent' ? 'Member' : 'Project'}<select name="parent" required className="input-dark w-full"><option value="">Select...</option>{options.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}</select></label>
      {kind === 'agent' ? <><label className="block">Provider<select name="provider" className="input-dark w-full"><option value="openai">OpenAI</option><option value="anthropic">Anthropic</option></select></label><label className="block">Model<input name="model" required className="input-dark w-full" /></label></> : <label className="block">Goal<textarea name="goal" className="input-dark w-full" /></label>}
      {error && <p role="alert" className="text-red-400">{error}</p>}
      <button disabled={busy} className="px-3 py-2 bg-blue-600 rounded">{busy ? 'Saving...' : 'Create'}</button><button type="button" disabled={busy} onClick={() => setOpen(false)} className="ml-4">Cancel</button>
    </form></div>}
  </>;
}
