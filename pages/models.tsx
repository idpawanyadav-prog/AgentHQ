import React from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api-client';
import {useLiveData} from '@/lib/use-live-data';
export default function ModelsPage() {
 const {data,error}=useLiveData(api.getModels);
 return <Layout activeNav="models"><h1 className="text-2xl font-bold mb-6">Models</h1><p className="text-slate-400 mb-4">Models assigned to configured agents.</p>
 {error && <p role="alert">{error}</p>}
 {!data ? <p>Loading models...</p> : <div className="grid md:grid-cols-2 gap-4">{data.map((m:any)=><section className="bg-slate-800 p-4 rounded" key={m.id}><h2 className="text-xl">{m.name}</h2><p>{m.provider} · {m.assignments} assignments</p><p className="text-slate-400">{m.agentNames.join(', ')}</p></section>)}{!data.length && <p>No models assigned. Add an agent first.</p>}</div>}
 </Layout>;
}
