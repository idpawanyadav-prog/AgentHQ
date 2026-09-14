import React from 'react';
import Layout from '@/components/Layout';
import api from '@/lib/api-client';
import {useLiveData} from '@/lib/use-live-data';
export default function CostPage() {
 const {data, error} = useLiveData(api.getCost);
 return <Layout activeNav="cost"><h1 className="text-2xl font-bold mb-6">Cost & Usage</h1>
 {error && <p role="alert">{error}</p>}
 {!data ? <p>Loading usage...</p> : <div className="space-y-4">
 <p>Measured tokens: <strong>{data.totalTokens.toLocaleString()}</strong></p>
 <p>Calls with recorded usage: <strong>{data.measuredCalls}</strong></p>
 <p>Recorded cost: <strong>{data.totalCost === null ? 'Unavailable' : '$' + data.totalCost.toFixed(4)}</strong></p>
 <p className="text-slate-400">Usage refreshes every 2 seconds. Costs require a recorded price for each call; configured token limits are not consumption.</p>
 {data.measuredCalls === 0 && <p>No measured AI usage has been recorded yet.</p>}
 </div>}</Layout>;
}
