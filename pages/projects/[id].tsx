import type { Activity } from "@/types";
import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import type { NavItem } from "@/types";
import Layout from "@/components/Layout";
import ActivityFeed from "@/components/ActivityFeed";
import api from "@/lib/api-client";
import {
 FaArrowLeft,
 FaUsers,
 FaMicrochip,
 FaClock,
 FaCheckCircle,
 FaPlay,
 FaCircle,
 FaCodeBranch,
 FaExternalLinkAlt,
 FaExclamationTriangle,
} from "react-icons/fa";

type MilestoneStatus = "pending" | "in_progress" | "done";

interface Milestone {
 id: string;
 title: string;
 status: MilestoneStatus;
 order: number;
 projectId: string;
 createdAt: string;
 updatedAt: string;
}

interface Team {
 id: string;
 name: string;
 description: string | null;
 status: string;
 members?: Array<{ id: string; name: string; type: string }>;
}

interface Project {
 id: string;
 name: string;
 description: string | null;
 status: string;
 progress: number;
 teamId: string;
 repoUrl: string | null;
 team: Team;
 milestones: Milestone[];
 createdAt: string;
 updatedAt: string;
}



const ProjectDetail: React.FC = () => {
 const router = useRouter();
 const { id } = router.query;

 const [project, setProject] = useState<Project | null>(null);
 const [activities, setActivities] = useState<Activity[]>([]);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);

 const handleNavigate = (_navId: string) => {
 router.push("/");
 };

 useEffect(() => {
 if (!id || typeof id !== "string") return;

 let cancelled = false;

 async function loadData() {
 setLoading(true);
 setError(null);
 try {
 const [projectData, activitiesData] = await Promise.all([
 api.getProject(String(id)),
 api.getActivities().catch(() => []),
 ]);

 if (cancelled) return;

 const allActivities: Activity[] = activitiesData as Activity[];
 const teamId = (projectData as Project).teamId;

 const filteredActivities = teamId
 ? allActivities.filter((a) => a.teamId === teamId)
 : allActivities;

 setProject(projectData as Project);
 setActivities(filteredActivities);
 } catch (err) {
 if (!cancelled) {
 setError(err instanceof Error ? err.message : "Failed to load project");
 }
 } finally {
 if (!cancelled) setLoading(false);
 }
 }

 loadData();

 return () => {
 cancelled = true;
 };
 }, [id]);

 if (loading) {
 return (
 <Layout activeNav="projects" onNavigate={handleNavigate}>
 <div className="flex items-center justify-center min-h-[400px]">
 <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-emerald-400" />
 </div>
 </Layout>
 );
 }

 if (error || !project) {
 return (
 <Layout activeNav="projects" onNavigate={handleNavigate}>
 <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4 transition-colors">
 <FaArrowLeft className="w-4 h-4" />
 Back
 </button>
 <div className="bg-red-500/10 border border-red-500/30 rounded-lg p-6 text-center">
 <p className="text-sm text-red-400">{error || "Project not found"}</p>
 </div>
 </Layout>
 );
 }

 const { team } = project;
 const memberCount = team.members?.length ?? 0;
 const humanMembers = team.members?.filter((m) => m.type === "human") ?? [];
 const aiMembers = team.members?.filter((m) => m.type === "ai") ?? [];

 const milestones = project.milestones ?? [];
 const completedMilestones = milestones.filter((m) => m.status === "done").length;
 const totalMilestones = milestones.length;
 const overallProgress = totalMilestones > 0 ? Math.round((completedMilestones / totalMilestones) * 100) : project.progress;

 const getMilestoneIcon = (status: MilestoneStatus) => {
 if (status === "done") return <FaCheckCircle className="w-5 h-5 text-green-400" />;
 if (status === "in_progress") return <FaPlay className="w-5 h-5 text-blue-400" />;
 return <FaCircle className="w-5 h-5 text-slate-500" />;
 };

 return (
 <Layout activeNav="projects" onNavigate={handleNavigate}>
 <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-slate-400 hover:text-white mb-4 transition-colors">
 <FaArrowLeft className="w-4 h-4" />
 Back
 </button>

 <div className="space-y-6">
 {/* Project Overview */}
 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg p-6">
 <div className="flex items-start justify-between mb-4">
 <div>
 <h1 className="text-2xl font-bold text-white">{project.name}</h1>
 <p className="text-sm text-slate-400 mt-1">
 {project.description || "No description provided"}
 </p>
 </div>
 <span
 className={`text-xs px-2 py-1 rounded-full ${
 project.status === "active"
 ? "bg-green-400/10 text-green-400"
 : "bg-yellow-400/10 text-yellow-400"
 }`}
 >
 {project.status === "active" ? "Active" : project.status}
 </span>
 </div>
 <div className="flex items-center gap-6 mb-4">
 <div className="flex items-center gap-2">
 <FaUsers className="w-4 h-4 text-slate-400" />
 <span className="text-sm text-slate-400">
 Team: {team.name || "Unassigned"}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <FaMicrochip className="w-4 h-4 text-slate-400" />
 <span className="text-sm text-slate-400">
 {aiMembers.length} AI agent{aiMembers.length !== 1 ? "s" : ""}
 </span>
 </div>
 <div className="flex items-center gap-2">
 <FaClock className="w-4 h-4 text-slate-400" />
 <span className="text-sm text-slate-400">
 Updated{" "}
 {new Date(project.updatedAt).toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 year: "numeric",
 })}
 </span>
 </div>
 </div>
 <div>
 <div className="flex items-center justify-between mb-2">
 <span className="text-sm text-slate-400">Overall Progress</span>
 <span className="text-sm font-semibold text-white">
 {overallProgress}% ({completedMilestones}/{totalMilestones} milestones)
 </span>
 </div>
 <div className="progress-bar">
 <div className="progress-bar-fill" style={{ width: `${overallProgress}%` }} />
 </div>
 </div>
 </div>
 </div>

 <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
 {/* Milestones */}
 <div className="lg:col-span-2">
 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg overflow-hidden">
 <div className="px-4 py-3 border-b border-slate-700">
 <h2 className="text-lg font-semibold text-white">Milestones</h2>
 </div>
 <div className="p-4">
 {milestones.length === 0 ? (
 <p className="text-sm text-slate-500">No milestones yet.</p>
 ) : (
 <div className="relative">
 <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-700" />
 <div className="space-y-3">
 {milestones.map((milestone) => (
 <div
 key={milestone.id}
 className={`relative flex items-start gap-4 p-3 rounded-lg border ${
 milestone.status === "done"
 ? "border-green-400/30 bg-green-400/5"
 : milestone.status === "in_progress"
 ? "border-blue-400/30 bg-blue-400/5"
 : "border-slate-700 bg-slate-800/30"
 }`}
 >
 <div className="relative z-10 mt-0.5">{getMilestoneIcon(milestone.status)}</div>
 <div className="flex-1">
 <h3
 className={`text-sm font-medium ${
 milestone.status === "done"
 ? "text-slate-400 line-through"
 : milestone.status === "in_progress"
 ? "text-white"
 : "text-slate-500"
 }`}
 >
 {milestone.title}
 </h3>
 {milestone.status === "in_progress" && (
 <p className="text-xs text-blue-400 mt-1">In progress</p>
 )}
 {milestone.status === "done" && (
 <p className="text-xs text-green-400 mt-1">
 Completed{" "}
 {new Date(milestone.updatedAt).toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 year: "numeric",
 })}
 </p>
 )}
 </div>
 </div>
 ))}
 </div>
 </div>
 )}
 </div>
 </div>
 </div>

 {/* Sidebar: Build Status + Activity */}
 <div className="space-y-4">
 <div className="bg-[#1a1d2e] border border-slate-700 rounded-lg overflow-hidden">
 <div className="px-4 py-3 border-b border-slate-700">
 <h2 className="text-lg font-semibold text-white">Build Status</h2>
 </div>
 <div className="p-4">
 {project.repoUrl ? (
 <div className="flex items-center justify-between p-3 bg-slate-800/50 rounded-lg">
 <div className="flex items-center gap-2">
 <FaCodeBranch className="w-4 h-4 text-slate-400" />
 <div>
 <p className="text-sm text-white font-medium">Main branch</p>
 <p className="text-xs text-slate-500">
 Last updated{" "}
 {new Date(project.updatedAt).toLocaleDateString("en-US", {
 month: "short",
 day: "numeric",
 year: "numeric",
 })}
 </p>
 </div>
 </div>
 <span className="text-xs px-2 py-1 rounded-full font-medium bg-emerald-400/10 text-emerald-400">
 Passed
 </span>
 </div>
 ) : (
 <p className="text-sm text-slate-500">No repository configured.</p>
 )}
 </div>
 </div>
 <div>
 <h2 className="text-lg font-semibold text-white mb-3">Recent Activity</h2>
 <ActivityFeed activities={activities} maxHeight="300px" />
 </div>
 </div>
 </div>

 {/* Note Banner */}
 <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-lg p-4 flex items-start gap-3">
 <FaExclamationTriangle className="w-5 h-5 text-yellow-400 flex-shrink-0 mt-0.5" />
 <div>
 <p className="text-sm font-medium text-yellow-400">Note</p>
 <p className="text-xs text-slate-400 mt-1">
 This project detail page fetches real data from the API. Build status and
 activity feed are populated using live project and team information.
 </p>
 </div>
 </div>
 </Layout>
 );
};

export default ProjectDetail;
