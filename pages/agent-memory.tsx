import React, { useEffect, useState } from "react";
import { useRouter } from "next/router";
import Layout from "@/components/Layout";
import api from "@/lib/api-client";
import {
 FaBrain,
 FaSearch,
 FaPlus,
 FaCode,
 FaPaintBrush,
 FaFileAlt,
 FaEllipsisH,
 FaEdit,
 FaTrash,
 FaExternalLinkAlt,
 FaTimes,
 FaCheck,
 FaRobot,
 FaUserPlus,
 FaCog,
 FaLayerGroup,
} from "react-icons/fa";

import {
 Agent,
 RoleGroup,
 InstructionFile,
 AgentAssignment,
 NavItem,
} from "@/types";

// --- Mock Data -------------------------------------------------------

const MOCK_ROLE_GROUPS: RoleGroup[] = [
 {
 id: "rg-1",
 name: "Sr. Developer",
 subtitle: "Senior-level development standards",
 icon: "code",
 instructionCount: 3,
 skillCount: 4,
 skills: [
 { id: "skill-1", name: "Code Review", level: "expert", description: "Reviews architecture, maintainability, and defects.", updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
 { id: "skill-2", name: "TypeScript", level: "advanced", description: "Builds strongly typed application features.", updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
 { id: "skill-3", name: "API Design", level: "advanced", description: "Designs robust service contracts and integrations.", updatedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
 { id: "skill-4", name: "Performance", level: "intermediate", description: "Finds practical optimizations across the stack.", updatedAt: new Date(Date.now() - 1 * 86400000).toISOString() },
 ],
 instructions: [
 {
 id: "inst-1",
 filename: "coding-standards.md",
 title: "Coding Standards for Senior Developers",
 description:
 "Guidelines for writing clean, maintainable, and well-documented code.",
 content: `# Coding Standards for Senior Developers

## General Principles
- Write clean, maintainable, and well-documented code
- Follow SOLID principles
- Prefer composition over inheritance
- Keep functions small and focused

## TypeScript Guidelines
- Use strict type checking
- Avoid \`any\` type - use proper interfaces
- Prefer readonly for immutable data
- Use meaningful variable names

## Code Review Standards
- All PRs require at least one approval
- Check for security vulnerabilities
- Ensure test coverage >= 80%
- Verify documentation is updated`,
 updatedAt: new Date(Date.now() - 2 * 86400000).toISOString(),
 },
 {
 id: "inst-2",
 filename: "architectural-patterns.md",
 title: "Architectural Patterns",
 description:
 "Guidelines for implementing common architectural patterns.",
 content: `# Architectural Patterns

## Layered Architecture
- Presentation Layer: UI components
- Business Logic Layer: Core services
- Data Access Layer: Repository implementations

## Event-Driven Design
- Use events for loose coupling
- Implement proper event handlers
- Handle event errors gracefully`,
 updatedAt: new Date(Date.now() - 5 * 86400000).toISOString(),
 },
 {
 id: "inst-3",
 filename: "performance-guidelines.md",
 title: "Performance Optimization",
 description:
 "Best practices for optimizing application performance.",
 content: `# Performance Optimization

## Database
- Use indexes for frequent queries
- Implement connection pooling
- Cache frequently accessed data

## Frontend
- Lazy load components
- Optimize bundle size
- Use memoization where appropriate`,
 updatedAt: new Date(Date.now() - 1 * 86400000).toISOString(),
 },
 ],
 assignments: [
 { agentId: "agent-01", agentName: "Agent-01" },
 { agentId: "agent-05", agentName: "Agent-05" },
 { agentId: "agent-12", agentName: "Agent-12" },
 ],
 },
 {
 id: "rg-2",
 name: "Designer",
 subtitle: "UI/UX design principles and standards",
 icon: "paint-brush",
 instructionCount: 2,
 skillCount: 3,
 skills: [
 { id: "skill-5", name: "Interaction Design", level: "advanced", description: "Shapes ergonomic flows and controls.", updatedAt: new Date(Date.now() - 3 * 86400000).toISOString() },
 { id: "skill-6", name: "Design Systems", level: "advanced", description: "Maintains reusable components and tokens.", updatedAt: new Date(Date.now() - 4 * 86400000).toISOString() },
 { id: "skill-7", name: "Accessibility", level: "intermediate", description: "Checks interfaces for inclusive usage.", updatedAt: new Date(Date.now() - 2 * 86400000).toISOString() },
 ],
 instructions: [
 {
 id: "inst-4",
 filename: "design-system.md",
 title: "Design System Guidelines",
 description: "Components, tokens, and design principles.",
 content: `# Design System Guidelines

## Color Palette
- Primary: Blue tones
- Secondary: Gray tones
- Accent: Highlight colors

## Typography
- Headings: Bold, clear hierarchy
- Body: Readable, accessible sizes
- Code: Monospace for technical content`,
 updatedAt: new Date(Date.now() - 3 * 86400000).toISOString(),
 },
 ],
 assignments: [
 { agentId: "agent-03", agentName: "Agent-03" },
 { agentId: "agent-07", agentName: "Agent-07" },
 ],
 },
 {
 id: "rg-3",
 name: "QA Engineer",
 subtitle: "Quality assurance and testing standards",
 icon: "tasks",
 instructionCount: 2,
 skillCount: 2,
 skills: [
 { id: "skill-8", name: "Test Planning", level: "advanced", description: "Defines focused test coverage and QA scope.", updatedAt: new Date(Date.now() - 4 * 86400000).toISOString() },
 { id: "skill-9", name: "Regression Testing", level: "intermediate", description: "Validates existing behavior after changes.", updatedAt: new Date(Date.now() - 6 * 86400000).toISOString() },
 ],
 instructions: [
 {
 id: "inst-5",
 filename: "testing-strategy.md",
 title: "Testing Strategy",
 description: "Unit, integration, and E2E testing approaches.",
 content: `# Testing Strategy

## Unit Tests
- Cover all business logic
- Use mocks for external dependencies
- Target 90% code coverage

## Integration Tests
- Test API endpoints
- Verify database operations
- Check error handling`,
 updatedAt: new Date(Date.now() - 4 * 86400000).toISOString(),
 },
 ],
 assignments: [
 { agentId: "agent-02", agentName: "Agent-02" },
 ],
 },
 {
 id: "rg-4",
 name: "Project Manager",
 subtitle: "Project management and coordination",
 icon: "cog",
 instructionCount: 1,
 skillCount: 2,
 skills: [
 { id: "skill-10", name: "Sprint Planning", level: "advanced", description: "Turns backlog items into shippable sprint plans.", updatedAt: new Date(Date.now() - 7 * 86400000).toISOString() },
 { id: "skill-11", name: "Coordination", level: "advanced", description: "Keeps agent assignments and blockers visible.", updatedAt: new Date(Date.now() - 5 * 86400000).toISOString() },
 ],
 instructions: [
 {
 id: "inst-6",
 filename: "project-workflow.md",
 title: "Project Workflow",
 description: "Sprint planning and task management.",
 content: `# Project Workflow

## Sprint Planning
- Review backlog before planning
- Define clear acceptance criteria
- Assign tasks based on capacity

## Daily Standups
- What was done yesterday
- What will be done today
- Any blockers`,
 updatedAt: new Date(Date.now() - 7 * 86400000).toISOString(),
 },
 ],
 assignments: [],
 },
];

// --- Helpers ---------------------------------------------------------

const formatTimeAgo = (dateString: string): string => {
 const date = new Date(dateString);
 const now = new Date();
 const diffMs = now.getTime() - date.getTime();
 const diffMins = Math.floor(diffMs / 60000);
 const diffHours = Math.floor(diffMs / 3600000);
 const diffDays = Math.floor(diffMs / 86400000);

 if (diffMins < 1) return "just now";
 if (diffMins < 60) return `${diffMins}m ago`;
 if (diffHours < 24) return `${diffHours}h ago`;
 if (diffDays < 7) return `${diffDays}d ago`;
 return `${Math.floor(diffDays / 7)}w ago`;
};

const getRoleGroupIcon = (icon: string) => {
 switch (icon) {
 case "code":
 return <FaCode className="w-4 h-4 text-blue-400" />;
 case "paint-brush":
 return <FaPaintBrush className="w-4 h-4 text-purple-400" />;
 case "tasks":
 return <FaLayerGroup className="w-4 h-4 text-amber-400" />;
 case "cog":
 return <FaCog className="w-4 h-4 text-teal-400" />;
 default:
 return <FaCode className="w-4 h-4 text-blue-400" />;
 }
};

const normalizeRoleGroup = (group: any): RoleGroup => ({
 ...group,
 subtitle: group.subtitle || group.description || "Role-based instructions and skills",
 icon: group.icon || "code",
 instructionCount: group.instructionCount ?? group.instructions?.length ?? 0,
 skillCount: group.skillCount ?? group.skills?.length ?? 0,
 instructions: (group.instructions || []).map((instruction: any) => ({
 ...instruction,
 title: instruction.title || instruction.filename,
 description: instruction.description || instruction.title || instruction.filename,
 updatedAt: instruction.updatedAt || new Date().toISOString(),
 })),
 skills: (group.skills || []).map((skill: any) => ({
 ...skill,
 description: skill.description || "",
 updatedAt: skill.updatedAt || new Date().toISOString(),
 })),
 assignments: group.assignments || [],
});

// --- Main Page -------------------------------------------------------

const AgentMemory: React.FC = () => {
 const router = useRouter();
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
 employees: "/employees",
 models: "/models",
 cost: "/cost",
 reports: "/reports",
 "agent-memory": "/agent-memory",
 };
 router.push(navHref[item] || "/");
 };

 const [roleGroups, setRoleGroups] = useState<RoleGroup[]>([]);
 const [agents, setAgents] = useState<Agent[]>([]);
 const [agentsError, setAgentsError] = useState<string | null>(null);
 const [loading, setLoading] = useState(true);
 const [error, setError] = useState<string | null>(null);
 const [searchQuery, setSearchQuery] = useState("");
 const [activeGroupId, setActiveGroupId] = useState<string>("");
 const [detailTab, setDetailTab] = useState<"instructions" | "skills">("instructions");
 const [editorMode, setEditorMode] = useState<"edit" | "preview">("edit");
 const [selectedInstructionId, setSelectedInstructionId] = useState<string>("");
 const [selectedSkillId, setSelectedSkillId] = useState<string>("");
 const [showInstructionMenu, setShowInstructionMenu] = useState<string | null>(null);
 const [showNewInstructionModal, setShowNewInstructionModal] = useState(false);
 const [showNewGroupModal, setShowNewGroupModal] = useState(false);
 const [newInstructionName, setNewInstructionName] = useState("");
 const [showAgentPicker, setShowAgentPicker] = useState(false);
 const [activeTab, setActiveTab] = useState("role-groups");
 const [showNewGroupFields, setShowNewGroupFields] = useState(false);
 const [newGroupName, setNewGroupName] = useState("");
 const [newGroupDescription, setNewGroupDescription] = useState("");
 const [newInstructionFilename, setNewInstructionFilename] = useState("");
 const [newInstructionTitle, setNewInstructionTitle] = useState("");
 const [saving, setSaving] = useState(false);
 const [saveMessage, setSaveMessage] = useState<string | null>(null);

 const activeGroup = roleGroups.find((g) => g.id === activeGroupId);
 const selectedInstruction = activeGroup?.instructions.find(
 (i) => i.id === selectedInstructionId
 );
 const selectedSkill = activeGroup?.skills.find((skill) => skill.id === selectedSkillId);

 // Auto-select first group
 useEffect(() => {
 if (roleGroups.length > 0 && !activeGroupId) {
 setActiveGroupId(roleGroups[0].id);
 if (roleGroups[0].instructions.length > 0) {
 setSelectedInstructionId(roleGroups[0].instructions[0].id);
 }
 if (roleGroups[0].skills.length > 0) {
 setSelectedSkillId(roleGroups[0].skills[0].id);
 }
 }
 }, [roleGroups, activeGroupId]);

 // Load data
 useEffect(() => {
 let cancelled = false;
 const load = async () => {
 try {
 setLoading(true);
 setError(null);
 let data: RoleGroup[];
 try {
 const response = await api.getRoleGroups();
 data = Array.isArray(response) ? response : (response as any).roleGroups || [];
 } catch {
 data = MOCK_ROLE_GROUPS;
 }
 if (cancelled) return;
 setRoleGroups(data.map(normalizeRoleGroup));
 } catch (err) {
 if (!cancelled) {
 setError(err instanceof Error ? err.message : "Failed to load role groups");
 }
 } finally {
 if (!cancelled) {
 setLoading(false);
 }
 }
 };
 load();
 return () => {
 cancelled = true;
 };
 }, []);

 useEffect(() => {
 let cancelled = false;
 const loadAgents = async () => {
 try {
 const data = await api.getAgents();
 if (!cancelled) {
 setAgents(Array.isArray(data) ? data : []);
 setAgentsError(null);
 }
 } catch (err) {
 if (!cancelled) {
 setAgents([]);
 setAgentsError(err instanceof Error ? err.message : "Failed to load agents");
 }
 }
 };
 loadAgents();
 return () => {
 cancelled = true;
 };
 }, []);

 const activeInstructionIds = activeGroup?.instructions.map((instruction) => instruction.id).join("|") || "";
 const activeSkillIds = activeGroup?.skills.map((skill) => skill.id).join("|") || "";

 // Keep selected instruction valid when group contents change
 useEffect(() => {
 if (!activeGroup) {
 setSelectedInstructionId("");
 return;
 }
 if (activeGroup.instructions.length === 0) {
 setSelectedInstructionId("");
 return;
 }
 if (!activeGroup.instructions.some((instruction) => instruction.id === selectedInstructionId)) {
 setSelectedInstructionId(activeGroup.instructions[0].id);
 }
 }, [activeGroup, activeInstructionIds, selectedInstructionId]);

 // Keep selected skill valid when group contents change
 useEffect(() => {
 if (!activeGroup) {
 setSelectedSkillId("");
 return;
 }
 if (activeGroup.skills.length === 0) {
 setSelectedSkillId("");
 return;
 }
 if (!activeGroup.skills.some((skill) => skill.id === selectedSkillId)) {
 setSelectedSkillId(activeGroup.skills[0].id);
 }
 }, [activeGroup, activeSkillIds, selectedSkillId]);

 // Filter role groups by search
 const filteredGroups = roleGroups.filter((group) =>
 group.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
 group.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
 );

 const handleSaveChanges = async () => {
 if (!activeGroup) return;

 setSaving(true);
 setSaveMessage(null);
 try {
 if (detailTab === "skills" && selectedSkill) {
 const savedSkill = await api.updateSkill(selectedSkill.id, {
 name: selectedSkill.name,
 level: selectedSkill.level,
 description: selectedSkill.description,
 });

 setRoleGroups((prev) =>
 prev.map((group) =>
 group.id === activeGroup.id
 ? {
 ...group,
 skills: group.skills.map((skill) =>
 skill.id === selectedSkill.id
 ? {
 ...skill,
 ...savedSkill,
 description: savedSkill.description || "",
 }
 : skill
 ),
 }
 : group
 )
 );
 setSaveMessage("Skill saved");
 } else if (selectedInstruction) {
 const savedInstruction = await api.updateInstruction(selectedInstruction.id, {
 filename: selectedInstruction.filename,
 title: selectedInstruction.title,
 content: selectedInstruction.content,
 });

 setRoleGroups((prev) =>
 prev.map((group) =>
 group.id === activeGroup.id
 ? {
 ...group,
 instructions: group.instructions.map((instruction) =>
 instruction.id === selectedInstruction.id
 ? {
 ...instruction,
 ...savedInstruction,
 description:
 savedInstruction.description ||
 instruction.description ||
 savedInstruction.title ||
 savedInstruction.filename,
 }
 : instruction
 ),
 }
 : group
 )
 );
 setSaveMessage("Instruction saved");
 } else {
 await api.updateRoleGroup(activeGroup.id, {
 description: activeGroup.subtitle,
 });
 setSaveMessage("Changes saved");
 }
 } catch (err) {
 setSaveMessage(err instanceof Error ? err.message : "Failed to save changes");
 } finally {
 setSaving(false);
 }
 };

 const handleRenameInstruction = async (instruction: InstructionFile) => {
 const nextFilename = window.prompt("Rename instruction file", instruction.filename);
 if (!nextFilename || nextFilename.trim() === instruction.filename) {
 setShowInstructionMenu(null);
 return;
 }

 const filename = nextFilename.trim().endsWith(".md")
 ? nextFilename.trim()
 : `${nextFilename.trim()}.md`;

 try {
 const savedInstruction = await api.updateInstruction(instruction.id, {
 filename,
 title: instruction.title,
 content: instruction.content,
 });
 setRoleGroups((prev) =>
 prev.map((group) =>
 group.id === activeGroupId
 ? {
 ...group,
 instructions: group.instructions.map((item) =>
 item.id === instruction.id
 ? {
 ...item,
 ...savedInstruction,
 description:
 savedInstruction.description ||
 item.description ||
 savedInstruction.title ||
 savedInstruction.filename,
 }
 : item
 ),
 }
 : group
 )
 );
 setSaveMessage("Instruction renamed");
 } catch (err) {
 setSaveMessage(err instanceof Error ? err.message : "Failed to rename instruction");
 } finally {
 setShowInstructionMenu(null);
 }
 };

 const handleDuplicateInstruction = async (instruction: InstructionFile) => {
 if (!activeGroup) return;

 const baseName = instruction.filename.replace(/\.md$/i, "");
 const copyFilename = `${baseName}-copy.md`;
 const copyTitle = `${instruction.title || baseName} Copy`;
 const fallbackInstruction: InstructionFile = {
 ...instruction,
 id: `inst-${Date.now()}`,
 filename: copyFilename,
 title: copyTitle,
 description: instruction.description,
 updatedAt: new Date().toISOString(),
 };

 try {
 const createdInstruction = await api.createInstruction(activeGroup.id, {
 filename: copyFilename,
 title: copyTitle,
 content: instruction.content,
 });
 const savedInstruction = {
 ...fallbackInstruction,
 ...createdInstruction,
 description: createdInstruction.description || fallbackInstruction.description,
 };
 setRoleGroups((prev) =>
 prev.map((group) =>
 group.id === activeGroup.id
 ? {
 ...group,
 instructions: [...group.instructions, savedInstruction],
 instructionCount: group.instructionCount + 1,
 }
 : group
 )
 );
 setSelectedInstructionId(savedInstruction.id);
 setSaveMessage("Instruction duplicated");
 } catch (err) {
 setSaveMessage(err instanceof Error ? err.message : "Failed to duplicate instruction");
 } finally {
 setShowInstructionMenu(null);
 }
 };

 const handleDeleteInstruction = async (instruction: InstructionFile) => {
 if (!activeGroup || !window.confirm(`Delete ${instruction.filename}?`)) {
 setShowInstructionMenu(null);
 return;
 }

 try {
 await api.deleteInstruction(instruction.id);
 const remainingInstructions = activeGroup.instructions.filter(
 (item) => item.id !== instruction.id
 );
 setRoleGroups((prev) =>
 prev.map((group) =>
 group.id === activeGroup.id
 ? {
 ...group,
 instructions: group.instructions.filter((item) => item.id !== instruction.id),
 instructionCount: Math.max(0, group.instructionCount - 1),
 }
 : group
 )
 );
 if (selectedInstructionId === instruction.id) {
 setSelectedInstructionId(remainingInstructions[0]?.id || "");
 }
 setSaveMessage("Instruction deleted");
 } catch (err) {
 setSaveMessage(err instanceof Error ? err.message : "Failed to delete instruction");
 } finally {
 setShowInstructionMenu(null);
 }
 };

 const handleEditRoleGroup = async () => {
 if (!activeGroup) return;

 const nextName = window.prompt("Role group name", activeGroup.name);
 if (!nextName || !nextName.trim()) return;

 const nextDescription = window.prompt(
 "Role group description",
 activeGroup.subtitle
 );
 if (nextDescription === null) return;

 try {
 const savedGroup = await api.updateRoleGroup(activeGroup.id, {
 name: nextName.trim(),
 description: nextDescription.trim(),
 });
 const normalizedGroup = normalizeRoleGroup({
 ...activeGroup,
 ...savedGroup,
 name: savedGroup.name || nextName.trim(),
 subtitle: savedGroup.subtitle || nextDescription.trim() || "Role-based instructions and skills",
 description: savedGroup.description ?? nextDescription.trim(),
 });
 setRoleGroups((prev) =>
 prev.map((group) => (group.id === activeGroup.id ? normalizedGroup : group))
 );
 setSaveMessage("Role group updated");
 } catch (err) {
 setSaveMessage(err instanceof Error ? err.message : "Failed to update role group");
 }
 };

 const handleDeleteRoleGroup = async () => {
 if (!activeGroup || !window.confirm(`Delete role group "${activeGroup.name}"?`)) return;

 try {
 await api.deleteRoleGroup(activeGroup.id);
 const remainingGroups = roleGroups.filter((group) => group.id !== activeGroup.id);
 setRoleGroups(remainingGroups);
 const nextGroup = remainingGroups[0];
 setActiveGroupId(nextGroup?.id || "");
 setSelectedInstructionId(nextGroup?.instructions[0]?.id || "");
 setSelectedSkillId(nextGroup?.skills[0]?.id || "");
 setSaveMessage("Role group deleted");
 } catch (err) {
 setSaveMessage(err instanceof Error ? err.message : "Failed to delete role group");
 }
 };

 const handleAssignAgent = async (agent: Agent) => {
 if (!activeGroup) return;
 if (activeGroup.assignments.some((assignment) => assignment.agentId === agent.id)) {
 setShowAgentPicker(false);
 return;
 }

 try {
 const assignment = await api.assignAgent(activeGroup.id, {
 agentId: agent.id,
 agentName: agent.name,
 agentStatus: agent.status,
 });
 setRoleGroups((prev) =>
 prev.map((group) =>
 group.id === activeGroup.id
 ? {
 ...group,
 assignments: [
 ...group.assignments.filter((item) => item.agentId !== agent.id),
 {
 agentId: assignment.agentId || agent.id,
 agentName: assignment.agentName || agent.name,
 },
 ],
 }
 : group
 )
 );
 setSaveMessage("Agent assigned");
 setShowAgentPicker(false);
 } catch (err) {
 setSaveMessage(err instanceof Error ? err.message : "Failed to assign agent");
 }
 };

 // Loading state
 if (loading) {
 return (
 <Layout activeNav="agent-memory" onNavigate={handleNavigate}>
 <div className="px-6 py-20 flex items-center justify-center">
 <div className="flex flex-col items-center gap-3">
 <div className="w-10 h-10 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
 <p className="text-sm text-slate-400">Loading role groups...</p>
 </div>
 </div>
 </Layout>
 );
 }

 // Error state
 if (error) {
 return (
 <Layout activeNav="agent-memory" onNavigate={handleNavigate}>
 <div className="px-6 py-20 flex items-center justify-center">
 <div className="flex flex-col items-center gap-3">
 <p className="text-sm text-red-400">Error: {error}</p>
 <button
 onClick={() => window.location.reload()}
 className="px-4 py-2 bg-blue-600 text-white rounded text-sm hover:bg-blue-500 transition-colors"
 >
 Retry
 </button>
 </div>
 </div>
 </Layout>
 );
 }

 return (
 <Layout activeNav="agent-memory" onNavigate={handleNavigate}>
 <div className="px-6 h-full">
 {/* Page Header */}
 <div className="flex items-start justify-between mb-5">
 <div className="flex items-center gap-3">
 <div className="w-9 h-9 rounded-lg bg-blue-500/15 flex items-center justify-center">
 <FaBrain className="w-5 h-5 text-blue-400" />
 </div>
 <div>
 <h1 className="text-xl font-bold text-[var(--text-primary)]">
 Agent Memory
 </h1>
 <p className="text-sm text-slate-400">
 Define role-based instructions and skills to guide your AI agents.
 </p>
 </div>
 </div>
 <button
 onClick={() => setShowNewGroupModal(true)}
 className="btn-primary flex items-center gap-1.5 text-xs px-3 py-1.5 h-8 flex-shrink-0"
 >
 <FaPlus className="w-3 h-3" />
 New Group
 </button>
 </div>

 {/* Top Tabs */}
 <div className="flex items-center gap-6 border-b border-[var(--border-default)] mb-4">
 {["Role Groups", "Global Memory", "Templates"].map((tab) => (
 <button
 key={tab}
 className={`pb-2.5 text-sm font-medium transition-colors relative ${
 tab === "Role Groups"
 ? "text-blue-400"
 : "text-slate-400 hover:text-slate-300"
 }`}
 >
 {tab}
 {tab === "Role Groups" && (
 <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-400 rounded-full" />
 )}
 </button>
 ))}
 </div>

 {/* Three-Column Layout */}
 <div className="flex gap-4" style={{ height: "calc(100vh - 220px)", minHeight: 400 }}>
 {/* LEFT SIDEBAR: Role Groups List */}
 <div className="w-64 flex-shrink-0 flex flex-col bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
 {/* Search */}
 <div className="p-3 border-b border-[var(--border-default)]">
 <div className="relative">
 <FaSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-slate-400 pointer-events-none" />
 <input
 type="text"
 value={searchQuery}
 onChange={(e) => setSearchQuery(e.target.value)}
 placeholder="Search groups..."
 className="input-field pl-8 w-full text-xs"
 />
 </div>
 </div>

 {/* Role Groups List */}
 <div className="flex-1 overflow-y-auto scrollbar-thin">
 {filteredGroups.map((group) => {
 const isActive = group.id === activeGroupId;
 return (
 <button
 key={group.id}
 onClick={() => {
 setActiveGroupId(group.id);
 setDetailTab("instructions");
 setSaveMessage(null);
 setShowAgentPicker(false);
 if (group.instructions.length > 0) {
 setSelectedInstructionId(group.instructions[0].id);
 }
 if (group.skills.length > 0) {
 setSelectedSkillId(group.skills[0].id);
 }
 }}
 className={`w-full text-left px-3 py-2.5 border-l-2 transition-colors ${
 isActive
 ? "bg-blue-500/10 border-blue-400"
 : "border-transparent hover:bg-[var(--bg-secondary)]/60"
 }`}
 >
 <div className="flex items-center gap-2.5">
 <div
 className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
 isActive
 ? "bg-blue-500/15"
 : "bg-[var(--bg-tertiary)]"
 }`}
 >
 {getRoleGroupIcon(group.icon)}
 </div>
 <div className="min-w-0 flex-1">
 <p
 className={`text-sm font-medium truncate ${
 isActive
 ? "text-blue-300"
 : "text-[var(--text-primary)]"
 }`}
 >
 {group.name}
 </p>
 <p className="text-[11px] text-slate-500 truncate">
 {group.instructionCount} instructions +{" "}
 {group.skillCount} skills
 </p>
 </div>
 </div>
 </button>
 );
 })}
 </div>

 {/* Add Group Button */}
 <div className="p-3 border-t border-[var(--border-default)]">
 <button
 onClick={() => setShowNewGroupModal(true)}
 className="w-full flex items-center gap-2 px-3 py-2 text-xs text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors"
 >
 <FaPlus className="w-3.5 h-3.5" />
 Add Role Group
 </button>
 </div>
 </div>

 {/* MIDDLE PANEL: Role Group Detail */}
 <div className="flex-1 min-w-0 flex flex-col bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
 {activeGroup ? (
 <>
 {/* Header */}
 <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
 <div className="flex items-center gap-3">
 <div className="w-8 h-8 rounded-lg bg-blue-500/15 flex items-center justify-center">
 {getRoleGroupIcon(activeGroup.icon)}
 </div>
 <div>
 <h3 className="text-sm font-semibold text-[var(--text-primary)]">
 {activeGroup.name}
 </h3>
 <p className="text-xs text-slate-500">
 {activeGroup.subtitle}
 </p>
 </div>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={handleEditRoleGroup}
 aria-label="Edit role group"
 title="Edit role group"
 className="p-1.5 text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors"
 >
 <FaEdit className="w-3.5 h-3.5" />
 </button>
 <button
 onClick={handleDeleteRoleGroup}
 aria-label="Delete role group"
 title="Delete role group"
 className="p-1.5 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-md transition-colors"
 >
 <FaTrash className="w-3.5 h-3.5" />
 </button>
 </div>
 </div>

 {/* Sub-tabs */}
 <div className="flex border-b border-[var(--border-default)]">
 {["Instructions", "Skills"].map((tab) => (
 <button
 key={tab}
 onClick={() => {
 setDetailTab(
 tab.toLowerCase() as "instructions" | "skills"
 );
 setSaveMessage(null);
 }}
 className={`px-4 py-2.5 text-xs font-medium transition-colors border-b-2 ${
 (tab.toLowerCase() === "instructions" &&
 detailTab === "instructions") ||
 (tab.toLowerCase() === "skills" &&
 detailTab === "skills")
 ? "text-blue-400 border-blue-400"
 : "text-slate-400 border-transparent hover:text-slate-300"
 }`}
 >
 {tab}
 </button>
 ))}
 </div>

 {/* Content */}
 <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
 {detailTab === "instructions" && (
 <div>
 {/* Instructions Header */}
 <div className="flex items-center justify-between mb-3">
 <p className="text-xs text-slate-400">
 Instruction files define how agents with this role
 should behave and perform tasks.
 </p>
 <button
 onClick={() => setShowNewInstructionModal(true)}
 className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
 >
 <FaPlus className="w-3 h-3" />
 New Instruction
 </button>
 </div>

 {/* Instruction Files List */}
 <div className="space-y-2">
 {activeGroup.instructions.map((instruction) => {
 const isSelected =
 instruction.id === selectedInstructionId;
 return (
 <button
 key={instruction.id}
 onClick={() => {
 setSelectedInstructionId(instruction.id);
 setSaveMessage(null);
 }}
 onContextMenu={(e) => {
 e.preventDefault();
 setShowInstructionMenu(
 showInstructionMenu === instruction.id
 ? null
 : instruction.id
 );
 }}
 className={`w-full text-left p-3 rounded-lg border transition-colors relative ${
 isSelected
 ? "bg-blue-500/10 border-blue-500/30"
 : "bg-[var(--bg-secondary)]/40 border-[var(--border-default)] hover:border-[var(--border-strong)]"
 }`}
 >
 <div className="flex items-start gap-3">
 <div className="mt-0.5">
 <FaFileAlt className="w-4 h-4 text-blue-400" />
 </div>
 <div className="flex-1 min-w-0">
 <p
 className={`text-sm font-medium truncate ${
 isSelected
 ? "text-blue-300"
 : "text-[var(--text-primary)]"
 }`}
 >
 {instruction.filename}
 </p>
 <p
 className={`text-xs mt-0.5 truncate ${
 isSelected
 ? "text-blue-400/70"
 : "text-slate-400"
 }`}
 >
 {instruction.title}
 </p>
 <p className="text-[11px] text-slate-500 mt-1 truncate">
 {instruction.description}
 </p>
 <p className="text-[11px] text-slate-600 mt-1">
 Updated {formatTimeAgo(instruction.updatedAt)}
 </p>
 </div>
 <div className="relative">
 <button
 onClick={(e) => {
 e.stopPropagation();
 setShowInstructionMenu(
 showInstructionMenu === instruction.id
 ? null
 : instruction.id
 );
 }}
 className="p-1 text-slate-400 hover:text-[var(--text-primary)] rounded"
 >
 <FaEllipsisH className="w-4 h-4" />
 </button>
 {showInstructionMenu === instruction.id && (
 <div
 onClick={(e) => e.stopPropagation()}
 className="absolute right-0 top-full mt-1 w-32 rounded-md shadow-lg z-50 border border-[var(--border-default)]"
 style={{
 backgroundColor: "var(--surface-card)",
 }}
 >
 <button
 onClick={() => handleRenameInstruction(instruction)}
 className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
 >
 Rename
 </button>
 <button
 onClick={() => handleDuplicateInstruction(instruction)}
 className="w-full text-left px-3 py-2 text-xs text-slate-300 hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)] transition-colors"
 >
 Duplicate
 </button>
 <button
 onClick={() => handleDeleteInstruction(instruction)}
 className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
 >
 Delete
 </button>
 </div>
 )}
 </div>
 </div>
 </button>
 );
 })}

 {activeGroup.instructions.length === 0 && (
 <div className="text-center py-8">
 <FaFileAlt className="w-8 h-8 text-slate-600 mx-auto mb-2" />
 <p className="text-sm text-slate-500">
 No instructions yet
 </p>
 <button
 onClick={() =>
 setShowNewInstructionModal(true)
 }
 className="mt-2 text-xs text-blue-400 hover:text-blue-300"
 >
 Create your first instruction
 </button>
 </div>
 )}
 </div>
 </div>
 )}

 {detailTab === "skills" && (
 <div>
 <div className="flex items-center justify-between mb-3">
 <p className="text-xs text-slate-400">
 Skills provide specialized capabilities to agents.
 </p>
 <button className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors">
 <FaPlus className="w-3 h-3" />
 New Skill
 </button>
 </div>
 <div className="space-y-2">
 {activeGroup.skills.map((skill) => {
 const isSelected = skill.id === selectedSkillId;
 return (
 <div
 key={skill.id}
 onClick={() => {
 setSelectedSkillId(skill.id);
 setSaveMessage(null);
 }}
 className={`p-3 rounded-lg border transition-colors ${
 isSelected
 ? "bg-blue-500/10 border-blue-500/30"
 : "bg-[var(--bg-secondary)]/40 border-[var(--border-default)] hover:border-[var(--border-strong)]"
 }`}
 >
 <div className="space-y-3">
 <div className="flex items-start justify-between gap-3">
 <div className="min-w-0">
 <div className="flex items-center gap-2">
 <FaCog className="w-3.5 h-3.5 text-teal-400 flex-shrink-0" />
 <input
 value={skill.name}
 onChange={(e) => {
 const value = e.target.value;
 setSelectedSkillId(skill.id);
 setSaveMessage(null);
 setRoleGroups((prev) =>
 prev.map((group) =>
 group.id === activeGroup.id
 ? {
 ...group,
 skills: group.skills.map((item) =>
 item.id === skill.id ? { ...item, name: value } : item
 ),
 }
 : group
 )
 );
 }}
 className="input-field w-full text-sm font-medium"
 />
 </div>
 <p className="text-[11px] text-slate-600 mt-1">
 Updated {formatTimeAgo(skill.updatedAt)}
 </p>
 </div>
 <select
 value={skill.level}
 onChange={(e) => {
 const value = e.target.value;
 setSelectedSkillId(skill.id);
 setSaveMessage(null);
 setRoleGroups((prev) =>
 prev.map((group) =>
 group.id === activeGroup.id
 ? {
 ...group,
 skills: group.skills.map((item) =>
 item.id === skill.id ? { ...item, level: value } : item
 ),
 }
 : group
 )
 );
 }}
 className="input-field w-32 text-xs capitalize flex-shrink-0"
 >
 <option value="beginner">Beginner</option>
 <option value="intermediate">Intermediate</option>
 <option value="advanced">Advanced</option>
 <option value="expert">Expert</option>
 </select>
 </div>
 <textarea
 value={skill.description}
 onChange={(e) => {
 const value = e.target.value;
 setSelectedSkillId(skill.id);
 setSaveMessage(null);
 setRoleGroups((prev) =>
 prev.map((group) =>
 group.id === activeGroup.id
 ? {
 ...group,
 skills: group.skills.map((item) =>
 item.id === skill.id ? { ...item, description: value } : item
 ),
 }
 : group
 )
 );
 }}
 placeholder="Describe what this skill enables..."
 className="input-field w-full text-xs"
 rows={3}
 />
 </div>
 </div>
 );
 })}

 {activeGroup.skills.length === 0 && (
 <div className="text-center py-8">
 <FaCog className="w-8 h-8 text-slate-600 mx-auto mb-2" />
 <p className="text-sm text-slate-500">
 No skills yet
 </p>
 <p className="text-xs text-slate-600 mt-1">
 Create skills for this role group to show them here.
 </p>
 </div>
 )}
 </div>
 </div>
 )}
 </div>

 {/* Assign to Agents Section */}
 <div className="border-t border-[var(--border-default)] p-4">
 <div className="flex items-center justify-between mb-2">
 <p className="text-xs text-slate-400">
 Agents with this role group will use these instructions
 and skills in their context.
 </p>
 <p className="text-[11px] text-slate-600">
 Last saved: 2 days ago
 </p>
 </div>
 <div className="flex items-center gap-2 mb-3 flex-wrap">
 {activeGroup.assignments.map((assignment) => (
 <span
 key={assignment.agentId}
 className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
 >
 <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
 {assignment.agentName}
 <button
 onClick={async () => {
 try {
 await api.removeAssignment(
 activeGroup.id,
 assignment.agentId
 );
 setRoleGroups((prev) =>
 prev.map((g) =>
 g.id === activeGroup.id
 ? {
 ...g,
 assignments: g.assignments.filter(
 (a) =>
 a.agentId !== assignment.agentId
 ),
 }
 : g
 )
 );
 setSaveMessage("Agent removed");
 } catch {
 setSaveMessage("Failed to remove agent");
 }
 }}
 className="ml-0.5 hover:text-emerald-200"
 >
 <FaTimes className="w-3 h-3" />
 </button>
 </span>
 ))}
 <button
 onClick={() => setShowAgentPicker(!showAgentPicker)}
 className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs border border-dashed border-slate-600 text-slate-400 hover:text-slate-300 hover:border-slate-500 transition-colors"
 >
 <FaUserPlus className="w-3 h-3" />
 Assign Agent
 </button>
 </div>
 {showAgentPicker && (
 <div className="mb-3 rounded-lg border border-[var(--border-default)] bg-[var(--bg-secondary)]/40 p-2">
 <div className="grid grid-cols-2 gap-2">
 {agentsError && (
 <p className="col-span-2 text-xs text-red-400">{agentsError}</p>
 )}
 {!agentsError && agents.length === 0 && (
 <p className="col-span-2 text-xs text-slate-500">No agents found in the Agents tab.</p>
 )}
 {agents.map((agent) => {
 const isAssigned = activeGroup.assignments.some(
 (assignment) => assignment.agentId === agent.id
 );
 return (
 <button
 key={agent.id}
 onClick={() => handleAssignAgent(agent)}
 disabled={isAssigned}
 className={`flex items-center justify-between gap-2 rounded-md border px-2.5 py-2 text-left text-xs transition-colors ${
 isAssigned
 ? "border-emerald-500/20 bg-emerald-500/10 text-emerald-400 opacity-70 cursor-not-allowed"
 : "border-[var(--border-default)] text-slate-300 hover:border-blue-500/40 hover:bg-blue-500/10 hover:text-[var(--text-primary)]"
 }`}
 >
 <span className="min-w-0">
 <span className="block truncate font-medium">{agent.name}</span>
 <span className="block text-[11px] text-slate-500 capitalize">{agent.status}</span>
 </span>
 <span className={`h-2 w-2 rounded-full ${agent.status === "working" ? "bg-amber-400" : "bg-emerald-400"}`} />
 </button>
 );
 })}
 </div>
 </div>
 )}

 {/* Action Buttons */}
 <div className="flex items-center justify-end gap-2">
 {saveMessage && (
 <p
 className={`mr-auto text-xs ${
 saveMessage.toLowerCase().includes("failed") || saveMessage.toLowerCase().includes("error")
 ? "text-red-400"
 : "text-emerald-400"
 }`}
 >
 {saveMessage}
 </p>
 )}
 <button className="px-3 py-1.5 text-xs text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors">
 Cancel
 </button>
 <button
 onClick={handleSaveChanges}
 disabled={saving}
 className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
 >
 {saving ? "Saving..." : "Save Changes"}
 </button>
 </div>
 </div>
 </>
 ) : (
 <div className="flex-1 flex items-center justify-center">
 <div className="text-center">
 <FaBrain className="w-12 h-12 text-slate-700 mx-auto mb-3" />
 <p className="text-sm text-slate-500">
 Select a role group to view details
 </p>
 <p className="text-xs text-slate-600 mt-1">
 Or create a new group to get started
 </p>
 </div>
 </div>
 )}
 </div>

 {/* RIGHT PANEL: File Editor */}
 <div className="w-[420px] flex-shrink-0 flex flex-col bg-[var(--surface-card)] border border-[var(--border-default)] rounded-lg overflow-hidden">
 {selectedInstruction ? (
 <>
 {/* Editor Header */}
 <div className="flex items-center justify-between p-3 border-b border-[var(--border-default)]">
 <div className="flex items-center gap-2.5">
 <FaFileAlt className="w-4 h-4 text-blue-400" />
 <span className="text-sm font-medium text-[var(--text-primary)]">
 {selectedInstruction.filename}
 </span>
 <FaExternalLinkAlt className="w-3 h-3 text-slate-500" />
 <button className="p-1 text-slate-400 hover:text-[var(--text-primary)] rounded">
 <FaEllipsisH className="w-3.5 h-3.5" />
 </button>
 </div>
 <div className="flex items-center gap-2">
 <button
 onClick={handleSaveChanges}
 disabled={saving}
 className="px-3 py-1 text-xs rounded-md bg-blue-600 text-white hover:bg-blue-500 disabled:opacity-60 disabled:cursor-not-allowed transition-colors"
 >
 {saving ? "Saving..." : "Save"}
 </button>
 <button
 onClick={() => setEditorMode("edit")}
 className={`px-3 py-1 text-xs rounded-md transition-colors ${
 editorMode === "edit"
 ? "bg-blue-600 text-white"
 : "text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
 }`}
 >
 Edit
 </button>
 <button
 onClick={() => setEditorMode("preview")}
 className={`px-3 py-1 text-xs rounded-md transition-colors ${
 editorMode === "preview"
 ? "bg-blue-600 text-white"
 : "text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)]"
 }`}
 >
 Preview
 </button>
 </div>
 </div>

 {/* Editor Body */}
 <div className="flex-1 overflow-hidden">
 {editorMode === "edit" ? (
 <div className="flex h-full">
 {/* Line numbers */}
 <div className="py-3 px-2 text-right select-none border-r border-[var(--border-default)]/50 flex-shrink-0">
 {selectedInstruction.content
 .split("\n")
 .map((_, i) => (
 <div
 key={i}
 className="text-[11px] leading-5 text-slate-600 font-mono"
 style={{ minHeight: "1.25rem" }}
 >
 {i + 1}
 </div>
 ))}
 </div>
 {/* Textarea */}
 <textarea
 value={selectedInstruction.content}
 onChange={(e) => {
 const updated = e.target.value;
 setSaveMessage(null);
 setRoleGroups((prev) =>
 prev.map((g) =>
 g.id === activeGroupId
 ? {
 ...g,
 instructions: g.instructions.map((inst) =>
 inst.id === selectedInstructionId
 ? { ...inst, content: updated }
 : inst
 ),
 }
 : g
 )
 );
 }}
 className="flex-1 p-3 bg-transparent text-sm text-[var(--text-primary)] font-mono leading-5 outline-none resize-none"
 style={{
 lineHeight: "1.25rem",
 tabSize: 2,
 }}
 spellCheck={false}
 />
 </div>
 ) : (
 <div className="p-4 h-full overflow-y-auto scrollbar-thin">
 <div
 className="prose prose-invert prose-sm max-w-none"
 dangerouslySetInnerHTML={{
 __html: selectedInstruction.content
 .replace(/^### (.*$)/gim, '<h3 class="text-sm font-semibold text-[var(--text-primary)] mt-3 mb-1">$1</h3>')
 .replace(/^## (.*$)/gim, '<h2 class="text-base font-semibold text-[var(--text-primary)] mt-4 mb-2">$1</h2>')
 .replace(/^# (.*$)/gim, '<h1 class="text-lg font-bold text-[var(--text-primary)] mb-2">$1</h1>')
 .replace(/^\- (.*$)/gim, '<li class="text-sm text-slate-300 ml-4">$1</li>')
 .replace(/\*\*(.*?)\*\*/g, '<strong class="text-[var(--text-primary)]">$1</strong>')
 .replace(/`(.*?)`/g, '<code class="bg-[var(--bg-tertiary)] px-1 py-0.5 rounded text-xs text-blue-300 font-mono">$1</code>')
 .replace(/\n/g, '<br/>'),
 }}
 />
 </div>
 )}
 </div>
 </>
 ) : (
 <div className="flex-1 flex items-center justify-center">
 <div className="text-center">
 <FaFileAlt className="w-10 h-10 text-slate-700 mx-auto mb-2" />
 <p className="text-sm text-slate-500">
 Select an instruction file to edit
 </p>
 </div>
 </div>
 )}
 </div>
 </div>

 {/* New Instruction Modal */}
 {showNewInstructionModal && (
 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
 <div
 className="rounded-lg border border-[var(--border-default)] w-full max-w-md mx-4"
 style={{ backgroundColor: "var(--surface-card)" }}
 >
 <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
 <h3 className="text-sm font-semibold text-[var(--text-primary)]">
 New Instruction
 </h3>
 <button
 onClick={() => {
 setShowNewInstructionModal(false);
 setNewInstructionName("");
 }}
 className="p-1 text-slate-400 hover:text-[var(--text-primary)] rounded"
 >
 <FaTimes className="w-4 h-4" />
 </button>
 </div>
 <div className="p-4">
 <label className="block text-xs text-slate-400 mb-1.5">
 Filename
 </label>
 <input
 type="text"
 value={newInstructionName}
 onChange={(e) => setNewInstructionName(e.target.value)}
 placeholder="e.g., coding-standards.md"
 className="input-field w-full text-sm mb-4"
 autoFocus
 />
 <label className="block text-xs text-slate-400 mb-1.5">
 Title
 </label>
 <input
 type="text"
 placeholder="e.g., Coding Standards"
 className="input-field w-full text-sm mb-4"
 />
 <label className="block text-xs text-slate-400 mb-1.5">
 Description
 </label>
 <textarea
 placeholder="Brief description of this instruction..."
 className="input-field w-full text-sm mb-4"
 rows={3}
 />
 <div className="flex items-center justify-end gap-2">
 <button
 onClick={() => {
 setShowNewInstructionModal(false);
 setNewInstructionName("");
 }}
 className="px-3 py-1.5 text-xs text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={async () => {
 if (!activeGroup || !newInstructionName.trim()) return;
 try {
 const newInstruction: InstructionFile = {
 id: `inst-${Date.now()}`,
 filename: newInstructionName.endsWith(".md")
 ? newInstructionName
 : `${newInstructionName}.md`,
 title: newInstructionName,
 description: "New instruction file",
 content: `# ${newInstructionName}\n\n`,
 updatedAt: new Date().toISOString(),
 };
 const createdInstruction = await api.createInstruction(activeGroup.id, newInstruction);
 const savedInstruction = {
 ...newInstruction,
 ...createdInstruction,
 description: createdInstruction.description || newInstruction.description,
 };
 setRoleGroups((prev) =>
 prev.map((g) =>
 g.id === activeGroup.id
 ? {
 ...g,
 instructions: [
 ...g.instructions,
 savedInstruction,
 ],
 instructionCount: g.instructionCount + 1,
 }
 : g
 )
 );
 setSelectedInstructionId(savedInstruction.id);
 setShowNewInstructionModal(false);
 setNewInstructionName("");
 } catch {
 // Fallback to local state
 if (!activeGroup || !newInstructionName.trim()) return;
 const newInstruction: InstructionFile = {
 id: `inst-${Date.now()}`,
 filename: newInstructionName.endsWith(".md")
 ? newInstructionName
 : `${newInstructionName}.md`,
 title: newInstructionName,
 description: "New instruction file",
 content: `# ${newInstructionName}\n\n`,
 updatedAt: new Date().toISOString(),
 };
 setRoleGroups((prev) =>
 prev.map((g) =>
 g.id === activeGroup.id
 ? {
 ...g,
 instructions: [
 ...g.instructions,
 newInstruction,
 ],
 instructionCount: g.instructionCount + 1,
 }
 : g
 )
 );
 setSelectedInstructionId(newInstruction.id);
 setShowNewInstructionModal(false);
 setNewInstructionName("");
 }
 }}
 className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
 >
 Create
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* New Group Modal */}
 {showNewGroupModal && (
 <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
 <div
 className="rounded-lg border border-[var(--border-default)] w-full max-w-md mx-4"
 style={{ backgroundColor: "var(--surface-card)" }}
 >
 <div className="flex items-center justify-between p-4 border-b border-[var(--border-default)]">
 <h3 className="text-sm font-semibold text-[var(--text-primary)]">
 New Role Group
 </h3>
 <button
 onClick={() => setShowNewGroupModal(false)}
 className="p-1 text-slate-400 hover:text-[var(--text-primary)] rounded"
 >
 <FaTimes className="w-4 h-4" />
 </button>
 </div>
 <div className="p-4">
 <label className="block text-xs text-slate-400 mb-1.5">
 Group Name
 </label>
 <input
 type="text"
 placeholder="e.g., Senior Developer"
 className="input-field w-full text-sm mb-4"
 autoFocus
 />
 <label className="block text-xs text-slate-400 mb-1.5">
 Description
 </label>
 <textarea
 placeholder="Brief description of this role group..."
 className="input-field w-full text-sm mb-4"
 rows={3}
 />
 <label className="block text-xs text-slate-400 mb-1.5">
 Icon
 </label>
 <div className="flex gap-2 mb-4">
 {[
 { value: "code", icon: <FaCode className="w-4 h-4" /> },
 {
 value: "paint-brush",
 icon: <FaPaintBrush className="w-4 h-4" />,
 },
 {
 value: "tasks",
 icon: <FaLayerGroup className="w-4 h-4" />,
 },
 { value: "cog", icon: <FaCog className="w-4 h-4" /> },
 ].map((option) => (
 <button
 key={option.value}
 className="p-2.5 rounded-md border border-[var(--border-default)] text-slate-400 hover:text-[var(--text-primary)] hover:border-[var(--border-strong)] transition-colors"
 >
 {option.icon}
 </button>
 ))}
 </div>
 <div className="flex items-center justify-end gap-2">
 <button
 onClick={() => setShowNewGroupModal(false)}
 className="px-3 py-1.5 text-xs text-slate-400 hover:text-[var(--text-primary)] hover:bg-[var(--bg-secondary)] rounded-md transition-colors"
 >
 Cancel
 </button>
 <button
 onClick={async () => {
 const nameInput = document.querySelector(
 'input[placeholder="e.g., Senior Developer"]'
 ) as HTMLInputElement;
 const descInput = document.querySelector(
 'textarea[placeholder="Brief description of this role group..."]'
 ) as HTMLTextAreaElement;
 const name = nameInput?.value || "New Group";
 const description = descInput?.value || "";
 try {
 const resp = await api.createRoleGroup({
 name,
 description,
 });
 setRoleGroups((prev) => [...prev, {
 ...resp,
 subtitle: description || "New role group",
 icon: "code",
 instructionCount: 0,
 skillCount: 0,
 instructions: [],
 skills: [],
 assignments: [],
 }]);
 } catch {
 const newGroup: RoleGroup = {
 id: `rg-${Date.now()}`,
 name,
 subtitle: description || "New role group",
 icon: "code",
 instructionCount: 0,
 skillCount: 0,
 instructions: [],
 skills: [],
 assignments: [],
 };
 setRoleGroups((prev) => [...prev, newGroup]);
 }
 setShowNewGroupModal(false);
 }}
 className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-500 transition-colors"
 >
 Create
 </button>
 </div>
 </div>
 </div>
 </div>
 )}

 {/* Click outside to close menus */}
 {showInstructionMenu && (
 <div
 className="fixed inset-0 z-40"
 onClick={() => setShowInstructionMenu(null)}
 />
 )}
 </div>
 </Layout>
 );
 };

 export default AgentMemory;
