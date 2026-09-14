import React, { useState } from "react";
import { useRouter } from "next/router";

interface TopBarProps {
 onSearch?: (query: string) => void;
}

const TopBar: React.FC<TopBarProps> = ({ onSearch }) => {
 const router = useRouter();
 const [searchQuery, setSearchQuery] = useState("");
 const [showNotifications, setShowNotifications] = useState(false);
 const [showUserMenu, setShowUserMenu] = useState(false);

 const notifications = [
 {
 id: "1",
 type: "info" as const,
 title: "PR #42 merged",
 description: "Frontend Squad merged feat/auth",
 time: "2 min ago",
 read: false,
 },
 {
 id: "2",
 type: "success" as const,
 title: "Build passed",
 description: "Backend Squad CI #128",
 time: "15 min ago",
 read: false,
 },
 {
 id: "3",
 type: "warning" as const,
 title: "Agent error",
 description: "Claude Dev #3 hit rate limit",
 time: "1 hour ago",
 read: true,
 },
 ];

 const unreadCount = notifications.filter((n) => !n.read).length;

 const handleSearch = (e: React.FormEvent) => {
 e.preventDefault();
 onSearch?.(searchQuery);
 };

 return (
 <header className="h-16 bg-[#0f1117] border-b border-slate-800 flex items-center justify-between px-6 sticky top-0 z-30">
 {/* Search */}
 <form onSubmit={handleSearch} className="flex-1 max-w-xl">
 <div className="relative">
 <svg
 className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth={2}
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <circle cx="11" cy="11" r="8" />
 <line x1="21" y1="21" x2="16.65" y2="16.65" />
 </svg>
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search tasks, agents, teams..."
 className="input-dark w-full pl-10 pr-4 py-2"
 />
 </div>
 </form>

 {/* Right side */}
 <div className="flex items-center gap-3 ml-6">
 {/* Notifications */}
 <div className="relative">
 <button
 onClick={() => {
 setShowNotifications(!showNotifications);
 setShowUserMenu(false);
 }}
 className="relative p-2 rounded-lg hover:bg-slate-800 transition-colors"
 >
 <svg
 className="w-5 h-5 text-slate-400"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth={2}
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
 <path d="M13.73 21a2 2 0 0 1-3.46 0" />
 </svg>
 {unreadCount > 0 && (
 <span className="notification-badge" />
 )}
 </button>

 {showNotifications && (
 <div className="absolute right-0 top-full mt-2 w-80 bg-[#1a1d2e] border border-slate-700 rounded-lg shadow-2xl z-50 animate-fade-in">
 <div className="p-3 border-b border-slate-700">
 <h3 className="text-sm font-semibold text-white">Notifications</h3>
 </div>
 <div className="max-h-80 overflow-y-auto">
 {notifications.map((notif) => (
 <div
 key={notif.id}
 className={`activity-item ${
 !notif.read ? "bg-slate-800/30" : ""
 }`}
 >
 <div
 className={`activity-dot ${
 notif.type === "success"
 ? "bg-green-400"
 : notif.type === "warning"
 ? "bg-yellow-400"
  : "bg-blue-400"
 }`}
 />
 <div className="flex-1 min-w-0">
 <p className="text-sm text-slate-200 truncate">{notif.title}</p>
 <p className="text-xs text-slate-500 truncate">{notif.description}</p>
 <p className="text-xs text-slate-600 mt-0.5">{notif.time}</p>
 </div>
 </div>
 ))}
 </div>
 <div className="p-2 border-t border-slate-700">
 <button className="btn-secondary w-full text-xs">
 Mark all as read
 </button>
 </div>
 </div>)}
 </div>

 {/* Divider */}
 <div className="w-px h-6 bg-slate-700" />

 {/* User menu */}
 <div className="relative">
 <button
 onClick={() => {
 setShowUserMenu(!showUserMenu);
 setShowNotifications(false);
 }}
 className="flex items-center gap-2 p-1 rounded-lg hover:bg-slate-800 transition-colors"
 >
 <div className="w-8 h-8 rounded-full bg-blue-600 flex items-center justify-center text-white text-xs font-bold">
 JD
 </div>
 <div className="hidden md:block text-left">
 <p className="text-sm text-white font-medium leading-tight">
 John Doe
 </p>
 <p className="text-xs text-slate-500 leading-tight">Admin</p>
 </div>
 <svg
 className="w-4 h-4 text-slate-400 hidden md:block"
 viewBox="0 0 24 24"
 fill="none"
 stroke="currentColor"
 strokeWidth={2}
 strokeLinecap="round"
 strokeLinejoin="round"
 >
 <polyline points="6 9 12 15 18 15" />
 </svg>
 </button>

 {showUserMenu && (
 <div className="absolute right-0 top-full mt-2 w-48 bg-[#1a1d2e] border border-slate-700 rounded-lg shadow-2xl z-50 animate-fade-in">
 <div className="py-1">
 {["Profile", "Settings", "GitHub Account"].map((item) => (
 <button
 key={item}
 className="w-full text-left px-4 py-2 text-sm text-slate-300 hover:bg-slate-800 hover:text-white transition-colors"
 >
 {item}
 </button>
 ))}
 <hr className="border-slate-700 my-1" />
 <button
 onClick={() => router.push("/api/auth/signout")}
 className="w-full text-left px-4 py-2 text-sm text-red-400 hover:bg-slate-800 transition-colors"
 >
 Sign out
 </button>
 </div>
 </div>
 )}
 </div>
	</div>
 </header>
 );
};

export default TopBar;
