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
 iconColor = "text-blue-400",
}) => {
 return (
 <div className="stat-card">
 <div className="flex items-start justify-between">
 <div>
 <p className="text-sm text-slate-400 mb-1">{label}</p>
 <p className="text-2xl font-bold text-white">{value}</p>
 {trend && (
 <p
 className={`text-xs mt-1 ${
 trend.positive !== false ? "text-green-400" : "text-red-400"
 }`}
 >
 {trend.positive !== false ? "+" : "-"}
 {Math.abs(trend.value)} {trend.label}
 </p>
 )}
 </div>
 <div className={`p-2 rounded-lg bg-slate-800 ${iconColor}`}>
 {icon}
 </div>
 </div>
 </div>
 );
};

export default StatCard;
