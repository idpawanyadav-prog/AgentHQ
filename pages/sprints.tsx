import React,{useState} from 'react';
import Layout from '@/components/Layout';
import CreateRecord from '@/components/CreateRecord';
import api from '@/lib/api-client';
import {useLiveData} from '@/lib/use-live-data';
export default function SprintsPage() {
 const {data,error}=useLiveData(api.getSprints);
 const [filter,setFilter]=useState('');
 return <Layout activeNav="sprints"><div className="flex justify-between items-center mb-6"><h1 className="text-2xl font-bold">Sprints</h1><CreateRecord kind="sprint" onCreated={()=>{}} /></div>
 <label>Status <select className="input-dark mb-4" value={filter} onChange={e=>setFilter(e.target.value)}><option value="">All statuses</option><option value="planned">Planned</option><option value="active">Active</option><option value="completed">Completed</option></select></label>
 {error && <p role="alert" className="text-red-400">{error}</p>}
 {!data ? <p>Loading sprints...</p> : <div className="space-y-4">{data.filter((s:any)=>!filter || s.status===filter).map((s:any)=><section key={s.id} className="bg-slate-800 p-5 rounded-lg"><h2 className="text-xl">{s.name}</h2><p className="text-slate-400">{s.project?.name} · {s.status}</p><p>{s.goal}</p><p>{s.tasks.filter((t:any)=>t.status==='done').length} / {s.tasks.length} tasks completed</p><p>{s.startDate ? new Date(s.startDate).toLocaleDateString() : 'Start date not set'} — {s.endDate ? new Date(s.endDate).toLocaleDateString() : 'End date not set'}</p></section>)}{!data.length && <p>No sprints yet. Create a sprint to get started.</p>}</div>}
 </Layout>;
}
