import {onDashboardChange} from '@/lib/socket-client';
import React, { useEffect, useState } from "react";
import api from "@/lib/api-client";
import type { Activity } from "@/types";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import ActivityFeed from "@/components/ActivityFeed";
import { FaStream } from "react-icons/fa";



export default function ActivityPage() {
	const router = useRouter();
 const [activities, setActivities] = useState<Activity[]>([]);
 const [error, setError] = useState('');
 const [live, setLive] = useState(true);
 useEffect(() => {
  let active = true;
  const refresh = () => api.getActivities().then(data => { if(active) {setActivities(data); setError('');} }).catch(e => active && setError(e.message));
  refresh();
  const unsubscribe = live ? onDashboardChange(refresh) : () => {};
  return () => { active = false; unsubscribe(); };
 }, [live]);
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

	return (
		<Layout activeNav="activity" onNavigate={handleNavigate}>
 <div className="space-y-6">
 <div className="flex items-center gap-2 mb-2">
 <FaStream className="text-blue-400" />
 <h1 className="text-3xl font-bold text-[var(--text-primary)]">Activity</h1>
 </div>
 <p className="text-slate-400">Real-time feed of team and agent activity across all projects.</p>
 <div className="bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
 <div className="px-4 py-3 border-b border-[var(--border-default)]">
 <h2 className="text-lg font-semibold text-[var(--text-primary)]">Live Activity Feed</h2>
 </div>
 <div className="p-4">
 {error && <p role="alert" className="text-red-400">{error}</p>}
 <ActivityFeed activities={activities} live={live && !error} onLiveChange={setLive} maxHeight="600px" title="All Activity" />
 </div>
 </div>
 </div>
 </Layout>
 );
}
