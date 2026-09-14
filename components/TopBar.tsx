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
		<div className="min-h-screen flex transition-colors duration-200" style={{ backgroundColor: "var(--bg-primary)", color: "var(--text-primary)" }}>
			<aside
				className={"sidebar-dark " + (showNav ? "flex fixed z-40" : "hidden") + " md:flex md:sticky w-60 flex-col flex-shrink-0 h-screen top-0"}
			>
				<button onClick={() => setShowNav(false)} className="md:hidden p-3" style={{ color: "var(--text-primary)" }}>Close navigation</button>
				<div className="p-4" style={{ borderBottom: "1px solid var(--sidebar-border)" }}>
					<h2 className="text-xs font-semibold uppercase tracking-wider" style={{ color: "var(--text-tertiary)" }}>Organization</h2>
				</div>

				<nav className="flex-1 overflow-y-auto scrollbar-thin p-3 space-y-0.5">
					{SIDEBAR_NAV_ITEMS.map((item) => {
						const Icon = item.icon;
						const isActive = activeNav ? activeNav === item.id : router.pathname === item.href;

						return (
							<Link
								key={item.id}
								href={item.href}
								aria-current={isActive ? "page" : undefined}
								className="sidebar-nav-item flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors duration-150"
								style={{
									backgroundColor: isActive ? "var(--active-bg)" : "transparent",
									color: isActive ? "var(--active-text)" : "var(--text-secondary)",
								}}
								onMouseEnter={(e) => {
									if (!isActive) e.currentTarget.style.backgroundColor = "var(--hover-bg)";
								}}
								onMouseLeave={(e) => {
									if (!isActive) e.currentTarget.style.backgroundColor = "transparent";
								}}
							>
								<Icon className="w-4 h-4 flex-shrink-0" />
								{item.label}
							</Link>
						);
					})}
				</nav>

				<div className="p-3" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
					<div className="flex flex-col items-center text-center py-4">
						<p className="text-[11px] italic leading-relaxed" style={{ color: "var(--text-tertiary)" }}>
							&ldquo;A company of AI agents building a better tomorrow.&rdquo;
						</p>
					</div>
				</div>
			</aside>

			<div className="flex-1 flex flex-col min-w-0 w-full">
				<header
					className="top-bar flex items-center justify-between px-6 flex-shrink-0 sticky top-0 z-30"
					style={{ borderBottom: "1px solid var(--border-default)" }}
				>
					<div className="flex items-center gap-3">
						<button aria-label="Open navigation" onClick={() => setShowNav(true)} className="md:hidden" style={{ color: "var(--text-primary)" }}>Menu</button>
						<svg width="36" height="36" viewBox="0 0 40 40" fill="none">
							<circle cx="20" cy="20" r="4" fill="#3b82f6" opacity="0.9" />
							<ellipse cx="20" cy="9" rx="6" ry="9" fill="none" stroke="#3b82f6" strokeWidth="1.5" opacity="0.7" />
							<ellipse cx="31" cy="20" rx="6" ry="9" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.7" transform="rotate(90 31 20)" />
							<ellipse cx="20" cy="31" rx="6" ry="9" fill="none" stroke="#93c5fd" strokeWidth="1.5" opacity="0.5" />
							<ellipse cx="9" cy="20" rx="6" ry="9" fill="none" stroke="#60a5fa" strokeWidth="1.5" opacity="0.7" transform="rotate(-90 9 20)" />
						</svg>

						<div>
							<span className="font-semibold text-sm" style={{ color: "var(--text-primary)" }}>AI Company</span>
							<span className="text-xs ml-2 hidden md:inline" style={{ color: "var(--text-tertiary)" }}>Build Faster. Smarter. Together.</span>
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
								className="relative p-2 rounded-lg transition-colors duration-150"
								style={{ color: "var(--text-secondary)" }}
								onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
								onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
							>
								<FaBell className="w-4 h-4" />
							</button>
							{showNotifications && (
								<div className="notification-dropdown absolute right-0 top-full p-4 w-64 rounded-lg z-50" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
									<Link href="/activity" className="dropdown-item" style={{ color: "var(--text-primary)" }}>View current activity and agent errors</Link>
								</div>
							)}
						</div>

						<div className="w-px h-6 hidden sm:block" style={{ backgroundColor: "var(--border-default)" }} />

						<div className="relative">
							<button
								type="button"
								aria-label="Toggle user menu"
								aria-expanded={showUserMenu}
								onClick={() => {
									setShowUserMenu(!showUserMenu);
									setShowNotifications(false);
								}}
								className="flex items-center gap-2 p-1 rounded-lg transition-colors duration-150"
								onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "var(--hover-bg)")}
								onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "transparent")}
							>
								<div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold overflow-hidden" style={{ background: "linear-gradient(135deg, #3b82f6, #2563eb)" }}>
									<svg viewBox="0 0 24 24" fill="none" className="w-full h-full">
										<rect width="24" height="24" rx="12" fill="#2563eb" />
										<circle cx="12" cy="9" r="4" fill="#93c5fd" />
										<ellipse cx="12" cy="20" rx="7" ry="5" fill="#93c5fd" />
									</svg>
								</div>

								<div className="hidden sm:block text-left">
									<p className="text-sm font-medium leading-tight" style={{ color: "var(--text-primary)" }}>Administrator</p>
									<p className="text-xs leading-tight" style={{ color: "var(--text-tertiary)" }}>Admin</p>
								</div>

								<FaChevronDown className="w-3 h-3 hidden sm:block" style={{ color: "var(--text-tertiary)" }} />
							</button>

							{showUserMenu && (
								<div className="dropdown-menu absolute right-0 top-full mt-2 w-48 rounded-lg shadow-2xl z-50 animate-fade-in" style={{ backgroundColor: "var(--card-bg)", border: "1px solid var(--card-border)" }}>
									<div className="py-1">
										{["Settings", "Sign out"].map((item) => (
											<button
												type="button"
												key={item}
												onClick={async () => {
													if (item === "Sign out") {
														await fetch("/api/auth", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "logout" }) });
														window.location.reload();
													} else {
														router.push("/settings");
													}
												}}
												className="dropdown-item w-full text-left px-4 py-2 text-sm transition-colors duration-150"
												style={{ color: "var(--text-secondary)" }}
												onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "var(--hover-bg)"; e.currentTarget.style.color = "var(--text-primary)"; }}
												onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "var(--text-secondary)"; }}
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

				<main className="flex-1 overflow-auto w-full p-4 sm:p-6" style={{ backgroundColor: "var(--bg-primary)" }}>
					{children}
				</main>
			</div>
		</div>
	);
}
