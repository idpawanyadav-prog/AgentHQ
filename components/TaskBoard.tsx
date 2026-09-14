import React, { useState, useCallback } from "react";
import {
 DndContext,
 DragEndEvent,
 DragOverlay,
 DragStartEvent,
 PointerSensor,
 KeyboardSensor,
 useSensor,
 useSensors,
 closestCorners,

 } from "@dnd-kit/core";
import {
 SortableContext,
 verticalListSortingStrategy,
 } from "@dnd-kit/sortable";
import type { TaskWithCI, TaskStatus, BoardFilters } from "../types";
import TaskCard from "./TaskCard";
import { FaPlus } from "react-icons/fa";

const COLUMNS: { id: TaskStatus; title: string; color: string }[] = [
 { id: "backlog", title: "Backlog", color: "border-slate-600" },
 { id: "in_progress", title: "In Progress", color: "border-blue-500" },
 { id: "review", title: "Review", color: "border-yellow-500" },
 { id: "done", title: "Done", color: "border-green-500" },
];

interface TaskBoardProps {
 tasks: TaskWithCI[];
 filters?: BoardFilters;
 onTaskClick?: (task: TaskWithCI) => void;
 onStatusChange?: (taskId: string, newStatus: TaskStatus) => void;
 onNewTask?: (status: TaskStatus) => void;
}

const TaskBoard: React.FC<TaskBoardProps> = ({
 tasks,
 filters,
 onTaskClick,
 onStatusChange,
 onNewTask,
}) => {
 const [activeTask, setActiveTask] = useState<TaskWithCI | null>(null);
 const [columnFilters, setColumnFilters] = useState<{
 [key: string]: string;
 }>({});

 const sensors = useSensors(
 useSensor(PointerSensor, {
 activationConstraint: {
 distance: 8,
 },
 }),
 useSensor(KeyboardSensor)
 );

 const getFilteredTasks = useCallback(
 (status: TaskStatus): TaskWithCI[] => {
 let filtered = tasks.filter((t) => t.status === status);

 if (filters?.priority?.length) {
 filtered = filtered.filter((t) =>
 filters.priority!.includes(t.priority)
 );
 }
 if (filters?.assignee?.length) {
 filtered = filtered.filter((t) =>
 filters.assignee!.includes(t.assigneeId ?? "")
 );
 }
 if (filters?.search) {
 const q = filters.search.toLowerCase();
 filtered = filtered.filter(
 (t) =>
 t.title.toLowerCase().includes(q) ||
 t.description?.toLowerCase().includes(q)
 );
 }
 if (columnFilters[status]) {
 const q = columnFilters[status].toLowerCase();
 filtered = filtered.filter(
 (t) =>
 t.title.toLowerCase().includes(q) ||
 t.description?.toLowerCase().includes(q)
 );
 }

 return filtered;
 },
 [tasks, filters, columnFilters]
 );

 const getTasksByStatus = useCallback(
 (status: TaskStatus) => getFilteredTasks(status),
 [getFilteredTasks]
 );

 const handleDragStart = (event: DragStartEvent) => {
 const { active } = event;
 const task = tasks.find((t) => t.id === active.id);
 if (task) setActiveTask(task);
 };

 const handleDragEnd = (event: DragEndEvent) => {
 const { active, over } = event;
 setActiveTask(null);

 if (!over) return;

 const draggedTaskId = active.id as string;
 const overColumnId = over.id as TaskStatus;

 const draggedTask = tasks.find((t) => t.id === draggedTaskId);
 if (!draggedTask || draggedTask.status === overColumnId) return;

 onStatusChange?.(draggedTaskId, overColumnId);
 };

 return (
 <DndContext
 sensors={sensors}
 collisionDetection={closestCorners}
 onDragStart={handleDragStart}
 onDragEnd={handleDragEnd}
 >
 <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-thin">
 {COLUMNS.map((column) => {
 const columnTasks = getTasksByStatus(column.id);

 return (
 <div
 key={column.id}
 className={`kanban-column flex-shrink-0 w-72 flex flex-col ${column.color}`}
 >
 {/* Column header */}
 <div className="kanban-column-header">
 <div className="flex items-center gap-2">
 <h3 className="text-sm font-semibold text-slate-300">
 {column.title}
 </h3>
 <span className="text-xs text-slate-500 bg-slate-800 px-2 py-0.5 rounded-full">
 {columnTasks.length}
 </span>
 </div>
 <button
 onClick={() => onNewTask?.(column.id)}
 className="p-1 rounded hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
 title="Add task"
 >
 <FaPlus className="w-4 h-4" />
 </button>
 </div>

 {/* Column filter */}
 <div className="px-3 py-2 border-b border-slate-800">
 <input
 type="text"
 placeholder="Filter..."
 value={columnFilters[column.id] ?? ""}
 onChange={(e) =>
 setColumnFilters((prev) => ({
 ...prev,
 [column.id]: e.target.value,
 }))
 }
 className="input-dark w-full text-xs py-1"
 />
 </div>

 {/* Tasks */}
 <div className="flex-1 overflow-y-auto scrollbar-thin p-3">
 <SortableContext
 items={columnTasks.map((t) => t.id)}
 strategy={verticalListSortingStrategy}
 >
 <div className="space-y-2.5">
 {columnTasks.map((task) => (
 <TaskCard
 key={task.id}
 task={task}
 onClick={() => onTaskClick?.(task)}
 />
 ))}
 {columnTasks.length === 0 && (
 <div className="text-center py-8 text-slate-600 text-xs">
 No tasks
 </div>
 )}
 </div>
 </SortableContext>
 </div>
 </div>
 );
 })}
 </div>

 {/* Drag overlay */}
 <DragOverlay>
 {activeTask && (
 <div className="rotate-3 shadow-2xl">
 <TaskCard task={activeTask} compact />
 </div>
 )}
 </DragOverlay>
 </DndContext>
 );
};

export default TaskBoard;
