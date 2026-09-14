import React from 'react';
import Layout from '@/components/Layout';
import {useLiveData} from '@/lib/use-live-data';
async function loadReports() { const r = await fetch('/api/reports'); if(!r.ok) throw new Error('Unable to load reports'); return r.json(); }
export default function ReportsPage() {
 const {data, error} = useLiveData(loadReports);
 return <Layout activeNav="reports"><h1 className="text-2xl font-bold mb-6">Reports</h1>
 {error && <p role="alert">{error}</p>}
 {!data ? <p>Loading reports...</p> : <div className="space-y-6">
 <div className="grid grid-cols-3 gap-4">{[['Tasks',data.totalTasks],['Completed',data.completed],['Blocked',data.blocked]].map(([name,value]) => <div className="p-4 bg-slate-800 rounded" key={name}><p>{name}</p><strong className="text-2xl">{value}</strong></div>)}</div>
 {['teams','sprints'].map(group => <section key={group}><h2 className="text-xl capitalize mb-3">{group}</h2><div className="overflow-x-auto"><table className="w-full text-left"><thead><tr><th>Name</th><th>Tasks</th><th>Completed</th><th>Completion</th></tr></thead><tbody>{data[group].map((row: {id:string;name:string;total:number;completed:number}) => <tr key={row.id}><td className="py-3">{row.name}</td><td>{row.total}</td><td>{row.completed}</td><td>{row.total ? Math.round(row.completed / row.total * 100) : 0}%</td></tr>)}</tbody></table></div></section>)}
 <p className="text-slate-400">Current database totals, refreshed every 2 seconds. Historical burndown, code quality, and cycle time require additional event history.</p>
 </div>}</Layout>;
}
