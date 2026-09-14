import React from "react";
import type { NavItem, NavConfig } from "../types";

const NAV_ITEMS: NavConfig[] = [
	{
		id: "overview",
		label: "Overview",
		href: "/",
		icon: (props) => (
			<svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
				<rect x="3" y="3" width="7" height="7" rx="1" />
				<rect x="14" y="3" width="7" height="7" rx="1" />
				<rect x="3" y="14" width="7" height="7" rx="1" />
				<rect x="14" y="14" width="7" height="7" rx="1" />
			</svg>
		),
	},
	{
		id: "teams",
		label: "Teams",
		href: "/teams",
		icon: (props) => (
			<svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
				<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" />
				<circle cx="9" cy="7" r="4" />
				<path d="M23 21v-2a4 4 0 0 0-3-3.87" />
				<path d="M16 3.13a4 4 0 0 1 0 7.75" />
			</svg>
		),
	},
	{
		id: "tasks",
		label: "Tasks",
		href: "/tasks",
		icon: (props) => (
			<svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
				<path d="M9 11l3 3L22 4" />
				<path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" />
			</svg>
		),
	},
	{
		id: "agents",
		label: "Agents",
		href: "/agents",
		icon: (props) => (
			<svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
				<rect x="3" y="11" width="18" height="10" rx="2" />
				<circle cx="12" cy="5" r="2" />
				<path d="M12 7v4" />
				<line x1="8" y1="16" x2="8" y2="16" />
				<line x1="16" y1="16" x2="16" y2="16" />
			</svg>
		),
	},
	{
		id: "projects",
		label: "Projects",
		href: "/projects",
		icon: (props) => (
			<svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
				<path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
			</svg>
		),
	},
	{
		id: "activity",
		label: "Activity",
		href: "/activity",
		icon: (props) => (
			<svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
				<polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
			</svg>
		),
	},
	{
		id: "settings",
		label: "Settings",
		href: "/settings",
		icon: (props) => (
			<svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
				<circle cx="12" cy="12" r="3" />
				<path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83" />
			</svg>
		),
	},
];

interface SidebarProps {
	activeNav: NavItem;
	onNavigate: (id: NavItem) => void;
}

const Sidebar: React.FC<SidebarProps> = ({ activeNav, onNavigate }) => {
	return (
		<aside className="sidebar-dark w-64 flex-shrink-0 flex flex-col h-screen sticky top-0">
			{/* Logo */}
			<div className="p-5 flex items-center gap-3">
				<div className="w-8 h-8 rounded-lg bg-[#3b82f6] flex items-center justify-center">
					<svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
						<path d="M12 2L2 7l10 5 10-5-10-5z" />
						<path d="M2 17l10 5 10-5" />
						<path d="M2 12l10 5 10-5" />
					</svg>
				</div>
				<div>
					<h1 className="text-sm font-bold text-white leading-tight">Agent Office</h1>
					<p className="text-[11px] text-[var(--text-tertiary)]">Dashboard</p>
				</div>
			</div>

			{/* Navigation */}
			<nav className="flex-1 px-3 overflow-y-auto scrollbar-thin">
				<div className="space-y-0.5">
					{NAV_ITEMS.map((item) => {
						const isActive = activeNav === item.id;
						return (
							<button
								key={item.id}
								onClick={() => onNavigate(item.id)}
								className={"nav-item w-full text-left " + (isActive ? "active" : "")}
							>
								<span className="inline-flex">
									<item.icon className="w-5 h-5" />
								</span>
								{item.label}
							</button>
						);
					})}
				</div>

				{/* Divider + Bottom section */}
				<div className="mt-8 pt-6" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
					<p className="sidebar-section-header px-3 mb-2" style={{ color: "var(--text-tertiary)" }}>Teams</p>
					<div className="space-y-0.5">
						{["Frontend Squad", "Backend Squad"].map((team) => (
							<button
								key={team}
								className="nav-item w-full text-left transition-colors duration-150"
								onClick={() => onNavigate("teams")}
							>
								<span className="w-2 h-2 rounded-full bg-[#22c55e] flex-shrink-0" />
								{team}
							</button>
						))}
					</div>
				</div>
			</nav>

			{/* Footer */}
			<div className="p-4" style={{ borderTop: "1px solid var(--sidebar-border)" }}>
				<p className="text-[11px] text-center" style={{ color: "var(--text-tertiary)" }}>
					v0.1.0 &middot; Phase 1
				</p>
			</div>
		</aside>
	);
};

export default Sidebar;
