'use client';

import React, { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/router";
import {
	FaThLarge,
	FaUsers,
	FaStream,
	FaClipboardList,
	FaUserFriends,
	FaFolderOpen,
	FaMicrochip,
	FaDollarSign,
	FaChartBar,
	FaCog,
	FaBell,
	FaChevronDown,
} from "react-icons/fa";

const SIDEBAR_NAV_ITEMS = [
 { id: "agents", label: "Agents", href: "/agents", icon: FaMicrochip },
 { id: "activity", label: "Activity", href: "/activity", icon: FaStream },
	{ id: "overview", label: "Overview", href: "/", icon: FaThLarge },
	{ id: "teams", label: "Teams", href: "/teams", icon: FaUsers },
	{ id: "projects", label: "Projects", href: "/projects", icon: FaFolderOpen },
	{ id: "sprints", label: "Sprints", href: "/sprints", icon: FaStream },
	{ id: "tasks", label: "Tasks", href: "/tasks", icon: FaClipboardList },
	{ id: "employees", label: "Employees", href: "/employees", icon: FaUserFriends },
	{ id: "models", label: "Models", href: "/models", icon: FaMicrochip },
	{ id: "cost", label: "Cost & Usage", href: "/cost", icon: FaDollarSign },
	{ id: "reports", label: "Reports", href: "/reports", icon: FaChartBar },
	{ id: "settings", label: "Settings", href: "/settings", icon: FaCog },
];

interface LayoutProps {
	children: React.ReactNode;
	activeNav?: string;
	onNavigate?: (id: string) => void;
}

export default function Layout({ children, activeNav }: LayoutProps) {
	const router = useRouter();
	const [showNotifications, setShowNotifications] = useState(false);
 const [showNav, setShowNav] = useState(false);
	const [showUserMenu, setShowUserMenu] = useState(false);

	return (
		<div className="min-h-screen bg-[#0f1117] flex">
			<aside className={`${showNav ? "flex fixed z-40" : "hidden"} md:flex md:sticky w-60 bg-[#111827] border-r border-slate-800 flex-col flex-shrink-0 h-screen top-0`}>
 <button onClick={() => setShowNav(false)} className="md:hidden p-3 text-white">Close navigation</button>
				<div className="p-4 border-b border-slate-800">
					<h2 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
						Organization
					</h2>
				</div>

				<nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-0.5">
					{SIDEBAR_NAV_ITEMS.map((item) => {
						const Icon = item.icon;
						const isActive = activeNav
							? activeNav === item.id
							: router.pathname === item.href;

						return (
							<Link
								key={item.id}
								href={item.href}
								aria-current={isActive ? "page" : undefined}
								className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors ${
									isActive
										? "bg-blue-500/10 text-blue-400"
										: "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
								}`}
							>
								<Icon className="w-4 h-4 flex-shrink-0" />
								{item.label}
							</Link>
						);
					})}
				</nav>

				<div className="p-3 border-t border-slate-800">
					<div className="flex flex-col items-center text-center py-4">
						<svg
							width="80"
							height="48"
							viewBox="0 0 80 48"
							fill="none"
							className="mb-2 opacity-60"
						>
							<polygon
								points="0,48 20,18 35,30 50,10 65,25 80,8 80,48"
								fill="#1e3a5f"
								opacity="0.7"
							/>
							<polygon
								points="50,10 65,25 80,8"
								fill="#3b82f6"
								opacity="0.3"
							/>
							<polygon
								points="20,18 35,30 50,10 35,18 20,18"
								fill="#2563eb"
								opacity="0.4"
							/>
							<circle
								cx="68"
								cy="14"
								r="4"
								fill="#fbbf24"
								opacity="0.8"
							/>
						</svg>
						<p className="text-[11px] text-slate-500 italic leading-relaxed">
							&ldquo;A company of AI agents building a better tomorrow.&rdquo;
						</p>
					</div>
				</div>
			</aside>

			<div className="flex-1 flex flex-col min-w-0 w-full">
				<header className="h-14 bg-[#0f1117] border-b border-slate-800 flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30">
					<div className="flex items-center gap-3"><button aria-label="Open navigation" onClick={() => setShowNav(true)} className="md:hidden text-white">Menu</button>
						<svg width="36" height="36" viewBox="0 0 40 40" fill="none">
							<circle
								cx="20"
								cy="20"
								r="4"
								fill="#3b82f6"
								opacity="0.9"
							/>
							<ellipse
								cx="20"
								cy="9"
								rx="6"
								ry="9"
								fill="none"
								stroke="#3b82f6"
								strokeWidth="1.5"
								opacity="0.7"
							/>
							<ellipse
								cx="31"
								cy="20"
								rx="6"
								ry="9"
								fill="none"
								stroke="#60a5fa"
								strokeWidth="1.5"
								opacity="0.7"
								transform="rotate(90 31 20)"
							/>
							<ellipse
								cx="20"
								cy="31"
								rx="6"
								ry="9"
								fill="none"
								stroke="#93c5fd"
								strokeWidth="1.5"
								opacity="0.5"
							/>
							<ellipse
								cx="9"
								cy="20"
								rx="6"
								ry="9"
								fill="none"
								stroke="#60a5fa"
								strokeWidth="1.5"
								opacity="0.7"
								transform="rotate(-90 9 20)"
							/>
						</svg>

						<div>
							<span className="text-white font-semibold text-sm">
								AI Company
							</span>
							<span className="text-slate-500 text-xs ml-2 hidden md:inline">
								Build Faster. Smarter. Together.
							</span>
						</div>
					</div>

					<div className="flex items-center gap-3">
						<div className="relative">
							<button
								type="button"
								aria-label="Toggle notifications"
								aria-expanded={showNotifications}
								onClick={() => {
									setShowNotifications(!showNotifications);
									setShowUserMenu(false);
								}}
								className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
							>
								<FaBell className="w-4 h-4 text-slate-400" />
								
							</button>
 {showNotifications && <div className="absolute right-0 top-full p-4 w-64 bg-slate-800 rounded text-white"><Link href="/activity">View current activity and agent errors</Link></div>}
						</div>

						<div className="w-px h-6 bg-slate-700 hidden sm:block" />

						<div className="relative">
							<button
								type="button"
								aria-label="Toggle user menu"
								aria-expanded={showUserMenu}
								onClick={() => {
									setShowUserMenu(!showUserMenu);
									setShowNotifications(false);
								}}
								className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-800 transition-colors"
							>
								<div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white text-xs font-bold overflow-hidden">
									<svg
										viewBox="0 0 24 24"
										fill="none"
										className="w-full h-full"
									>
										<rect width="24" height="24" rx="12" fill="#2563eb" />
										<circle cx="12" cy="9" r="4" fill="#93c5fd" />
										<ellipse cx="12" cy="20" rx="7" ry="5" fill="#93c5fd" />
									</svg>
								</div>

								<div className="hidden sm:block text-left">
									<p className="text-sm text-white font-medium leading-tight">
										Administrator
									</p>
									<p className="text-xs text-slate-500 leading-tight">
										Admin
									</p>
								</div>

								<FaChevronDown className="w-3 h-3 text-slate-500 hidden sm:block" />
							</button>

							{showUserMenu && (
								<div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1d2e] border border-slate-700 rounded-lg shadow-2xl z-50 animate-fade-in">
									<div className="py-1">
										{["Settings", "Sign out"].map((item) => (
											<button
												type="button"
												key={item}
 onClick={async () => {if(item === "Sign out") {await fetch("/api/auth",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({action:"logout"})});window.location.reload();} else router.push("/settings");}}
												className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
											>
												{item}
											</button>
										))}
									</div>
								</div>
							)}
						</div>
					</div>
				</header>

				<main className="flex-1 overflow-auto w-full p-4 sm:p-6 text-white">{children}</main>
			</div>
		</div>
	);
}