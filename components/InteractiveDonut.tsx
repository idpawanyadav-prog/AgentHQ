'use client';

import React, { useState } from "react";

export interface DonutSegment {
 label: string;
 value: number;
 color: string;
}

interface InteractiveDonutProps {
 segments: DonutSegment[];
 size?: number;
 strokeWidth?: number;
 centerLabel?: string;
 centerValue?: string | number;
 showCenterText?: boolean;
 showLegend?: boolean;
 legendLayout?: "horizontal" | "vertical";
}

export default function InteractiveDonut({
 segments,
 size = 160,
 strokeWidth = 22,
 centerLabel,
 centerValue,
 showCenterText = true,
 showLegend = true,
 legendLayout = "vertical",
}: InteractiveDonutProps) {
 const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

 const total = segments.reduce((s, seg) => s + seg.value, 0);
 const radius = (size - strokeWidth) / 2;
 const circumference = 2 * Math.PI * radius;

 let cumulativeValue = 0;
 const segmentPaths = segments.map((seg, i) => {
 const pct = total > 0 ? seg.value / total : 0;
 const dashLength = pct * circumference;
 const dashOffset = -cumulativeValue;
 cumulativeValue += dashLength;
 const isHovered = hoveredIndex === i;
 const isOtherHovered = hoveredIndex !== null && hoveredIndex !== i;
 return (
 <circle
 key={i}
 cx={size / 2}
 cy={size / 2}
 r={radius}
 fill="none"
 stroke={seg.color}
 strokeWidth={isHovered ? strokeWidth + 4 : strokeWidth}
 strokeDasharray={`${dashLength} ${circumference - dashLength}`}
 strokeDashoffset={dashOffset}
 transform={`rotate(-90 ${size / 2} ${size / 2})`}
 style={{
 cursor: "pointer",
 opacity: isOtherHovered ? 0.35 : 1,
 transition: "opacity 0.2s ease, stroke-width 0.15s ease",
 }}
 onMouseEnter={() => setHoveredIndex(i)}
 onMouseLeave={() => setHoveredIndex(null)}
 />
 );
 });

 const activeSeg = hoveredIndex !== null ? segments[hoveredIndex] : null;
 const displayValue = activeSeg
 ? activeSeg.value
 : centerValue ?? total;
 const displayLabel = activeSeg ? activeSeg.label : centerLabel ?? "Total";

 return (
 <div
 className="flex flex-col items-center w-full"
 onMouseLeave={() => setHoveredIndex(null)}
 >
 <div className="relative" style={{ width: size, height: size }}>
 <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
 {segmentPaths}
 {/* Inner mask circle to create clean donut */}
 <circle
 cx={size / 2}
 cy={size / 2}
 r={radius - strokeWidth / 2}
 fill="#1a1d2e"
 />
 </svg>
 {showCenterText && (
 <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
 <span
 className="text-white font-bold tabular-nums transition-all"
 style={{ fontSize: size * 0.11 }}
 >
 {typeof displayValue === "number"
 ? total === 0
 ? "0"
 : activeSeg
 ? activeSeg.value
 : centerValue ?? total
 : displayValue}
 </span>
 {displayLabel && (
 <span
 className="text-slate-400 mt-0.5"
 style={{ fontSize: size * 0.07 }}
 >
 {displayLabel}
 </span>
 )}
 </div>
 )}
 </div>

 {showLegend && (
 <div
 className={
 legendLayout === "horizontal"
 ? "grid grid-cols-2 gap-x-3 gap-y-1 mt-3 w-full"
 : "grid grid-cols-1 gap-1 mt-3 w-full"
 }
 >
 {segments.map((seg, i) => {
 const pct = total > 0 ? Math.round((seg.value / total) * 100) : 0;
 const isHovered = hoveredIndex === i;
 return (
 <div
 key={i}
 className="flex items-center gap-2 text-xs cursor-pointer rounded px-1 py-0.5 transition-colors"
 style={{
 backgroundColor: isHovered ? "rgba(148, 163, 184, 0.1)" : "transparent",
 }}
 onMouseEnter={() => setHoveredIndex(i)}
 onMouseLeave={() => setHoveredIndex(null)}
 >
 <span
 className="w-2.5 h-2.5 rounded-full flex-shrink-0 transition-transform"
 style={{
 backgroundColor: seg.color,
 transform: isHovered ? "scale(1.3)" : "scale(1)",
 }}
 />
 <span
 className={
 isHovered ? "text-white font-medium" : "text-slate-300"
 }
 >
 {seg.label}
 </span>
 <span className="ml-auto text-slate-500 tabular-nums">{pct}%</span>
 </div>
 );
 })}
 </div>
 )}
 </div>
 );
}
