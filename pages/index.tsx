import React from 'react';
import Link from 'next/link';
import Layout from '@/components/Layout';
import ActivityFeed from '@/components/ActivityFeed';
import api from '@/lib/api-client';
import {useLiveData} from '@/lib/use-live-data';
async function loadOverview() {
 const [teams,projects,tasks,agents,activities,usage] = await Promise.all([api.getTeams(),api.getProjects(),api.getTasks(),api.getAgents(),api.getActivities(),api.getCost()]);
 return {teams,projects,tasks,agents,activities,usage};
}
export default function Overview() {
 const {data,error} = useLiveData(loadOverview);
 return <Layout activeNav="overview"><h1 className="text-2xl font-bold mb-2">Overview</h1><p className="text-slate-400 mb-6">Teams, projects and agent activity. Updates every 2 seconds.</p>
 {error && <p role="alert" className="text-red-400">{error}</p>}
 {!data ? <p>Loading dashboard...</p> : <div className="space-y-6">
 <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">{[['Teams',data.teams.length],['Projects',data.projects.length],['Open tasks',data.tasks.filter((t:any)=>t.status!=='done').length],['Working agents',data.agents.filter((a:any)=>a.status==='working').length],['Measured tokens',data.usage.totalTokens.toLocaleString()],['Recorded cost',data.usage.totalCost === null ? 'Unavailable' : '$'+data.usage.totalCost.toFixed(4)]].map(([name,value])=><div key={name} className="bg-slate-800 p-4 rounded-lg"><p className="text-slate-400">{name}</p><strong className="text-2xl">{value}</strong></div>)}</div>
 <section><h2 className="text-xl mb-3">Teams</h2><div className="grid md:grid-cols-2 gap-4">{data.teams.map((t:any)=><Link href={'/teams/'+t.id} key={t.id} className="block bg-slate-800 rounded-lg p-4"><h3 className="font-semibold">{t.name}</h3><p className="text-slate-400">{t.description}</p><p>{t.members.length} members · {t.tasks.length} tasks · {t.status}</p></Link>)}</div></section>
 <ActivityFeed activities={data.activities} live={!error} />
 </div>}</Layout>;
}
