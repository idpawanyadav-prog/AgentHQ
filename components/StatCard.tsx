import React from "react";

interface StatCardProps {
	icon: React.ReactNode;
	label: string;
	value: string | number;
	trend?: {
		value: number;
		label: string;
		positive?: boolean;
	};
	iconColor?: string;
}

const StatCard: React.FC<StatCardProps> = ({
	icon,
	label,
	value,
	trend,
	iconColor = "text-[#3b82f6]",
}) => {
	const isPositive = trend?.positive !== false;
	const trendClass = isPositive ? "trend-up" : "trend-down";

	return (
		<div className="stat-card">
			<div className="flex items-start justify-between">
				<div>
					<p className="text-sm mb-1" style={{ color: "var(--text-secondary)" }}>{label}</p>
					<p className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>{value}</p>
					{trend && (
						<p className={"text-xs mt-1 transition-colors duration-150 " + trendClass}>
							{isPositive ? "+" : "-"}{Math.abs(trend.value)} {trend.label}
						</p>
					)}
				</div>
				<div className="rounded-lg p-2 transition-colors duration-150" style={{ backgroundColor: "var(--bg-tertiary)" }}>
					<span className={iconColor}>{icon}</span>
				</div>
			</div>
		</div>
	);
};

export default StatCard;
