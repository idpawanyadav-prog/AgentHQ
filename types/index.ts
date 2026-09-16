// ─── Core Domain Types ───────────────────────────────────────────────

export interface Member {
 id: string;
 name: string;
 role: string; // "PM", "Dev", "QA", "AI Agent", etc.
 type: "human" | "ai";
 avatar?: string;
 teamId: string;
 createdAt: string;
}

export interface AgentConfig {
 temperature?: number;
 maxTokens?: number;
 systemPrompt?: string;
 gatewayId?: string;
 configuredModelId?: string;
}

export interface Agent {
 tasks?: Task[];
 id: string;
 name: string; // e.g. "Claude Dev #1"
 type: GatewayProvider;
 model: string; // "claude-sonnet-4-5" | "gpt-4"
 memberId: string;
 config: AgentConfig;
 status: AgentStatus;
 createdAt: string;
 updatedAt: string;
}

export type AgentStatus = "idle" | "working" | "error";

export interface TeamMemberInfo {
 name: string;
 model: string;
}

export interface Team {
 id: string;
 name: string;
 description?: string;
 status: TeamStatus;
 letter: "A" | "B" | "G" | "D";
 teamColor: "blue" | "purple" | "orange" | "green";
 sprint: number;
 sprintOf: number;
 sprintProgress: number;
 daysLeft: number | null;
 activeSprints: number;
 openTasks: number;
 completed: number;
 members: Member[];
 teamMembers: TeamMemberInfo[];
 features: number;
 integrations: number;
 issues: number;
 dueDate: string;
 tasks: Task[];
 createdAt: string;
 updatedAt: string;
}

export type TeamStatus = "active" | "paused" | "archived";

export interface Project {
 id: string;
 name: string;
 description?: string;
 status: ProjectStatus;
 progress: number; // 0-100
 teamId: string;
 milestones: Milestone[];
 repoUrl?: string;
 createdAt: string;
 updatedAt: string;
}

export type ProjectStatus = "active" | "paused" | "completed";

export interface Milestone {
 id: string;
 title: string;
 status: MilestoneStatus;
 order: number;
 projectId: string;
}

export type MilestoneStatus = "pending" | "in_progress" | "done";

export interface Sprint {
 project?: Project;
 id: string;
 name: string;
 goal?: string;
 status: SprintStatus;
 startDate?: string;
 endDate?: string;
 order: number;
 projectId: string;
 tasks: Task[];
}

export type SprintStatus = "planned" | "active" | "completed";

export interface Task {
 id: string;
 title: string;
 description?: string;
 type: TaskType;
 priority: TaskPriority;
 status: TaskStatus;
 teamId: string;
 projectId: string;
 sprintId?: string;
 assigneeId?: string;
 assignee?: Member;
 agentId?: string;
 agent?: Agent;
 branch?: string;
 prNumber?: number;
 dependencies: string[];
 storyPoints?: number;
 dueDate?: string;
 acceptanceCriteria?: string;
 blocked: boolean;
 blockedReason?: string;
 createdAt: string;
 updatedAt: string;
}

export type TaskType = "task" | "bug" | "feature" | "chore";
export type TaskPriority = "low" | "medium" | "high" | "critical";
export type TaskStatus =
 | "backlog"
 | "ready"
 | "in_progress"
 | "review"
 | "testing"
 | "done"
 | "blocked";

export interface CIStatus {
 state: "pending" | "success" | "failure" | "error";
 url?: string;
 description?: string;
}

export interface TaskWithCI extends Task {
 ciStatus?: CIStatus;
}

export interface ActivityMeta {
 prNumber?: number;
 branch?: string;
 tokensUsed?: number;
 cost?: number;
 ciState?: string;
 [key: string]: unknown;
}

export type ActivityType =
 | "task_assigned"
 | "task_moved"
 | "commit"
 | "pr_opened"
 | "pr_merged"
 | "pr_closed"
 | "ci_passed"
 | "ci_failed"
 | "agent_started"
 | "agent_completed"
 | "agent_error"
 | "agent_benched"
 | "agent_joined"
 | "team_created"
 | "member_added"
 | "milestone_completed";

export interface Activity {
 id: string;
 type: ActivityType;
 description: string;
 meta: ActivityMeta | null;
 teamId: string;
 memberId?: string;
 member?: Member;
 taskId?: string;
 task?: Task;
 createdAt: string;
}

export interface Setting {
 id: string;
 key: string;
 value: string;
}

// ─── Kanban / Board ──────────────────────────────────────────────────

export interface KanbanColumn {
 id: TaskStatus;
 title: string;
 color: string;
 tasks: Task[];
}

export interface BoardFilters {
 priority?: TaskPriority[];
 assignee?: string[];
 search?: string;
}

// ─── API Response Shapes ─────────────────────────────────────────────

export interface TeamsResponse {
 teams: Team[];
 total: number;
}

export interface TasksResponse {
 tasks: Task[];
 total: number;
}

export interface ActivitiesResponse {
 activities: Activity[];
 total: number;
}

export interface DashboardStats {
 teamsCount: number;
 activeAgents: number;
 tasksInProgress: number;
 buildsPassing: number;
}

// ─── Navigation ──────────────────────────────────────────────────────

export type NavItem =
 | "overview"
 | "agent-office"
 | "teams"
 | "sprints"
 | "tasks"
 | "employees"
 | "projects"
 | "project-control"
 | "models"
 | "cost"
 | "reports"
 | "agents"
 | "activity"
 | "settings"
 | "agent-memory";

export interface NavConfig {
 id: NavItem;
 label: string;
 href: string;
 icon: React.ComponentType<{ className?: string }>;
}

// ─── Notification ────────────────────────────────────────────────────

export type NotificationType = "info" | "success" | "warning" | "error";

export interface Notification {
 id: string;
 type: NotificationType;
 title: string;
 description?: string;
 read: boolean;
 createdAt: string;
}

// ─── Gateway ────────────────────────────────────────────────────────────

export type GatewayProvider = "anthropic" | "openai" | "custom";

export interface Gateway {
 id: string;
 name: string;
 provider: GatewayProvider;
 baseUrl: string;
 apiKey: string;
 model: string;
 createdAt: string;
}

export interface ConfiguredModel {
 id: string;
 name: string;
 gatewayId: string;
 gatewayName: string;
 provider: GatewayProvider;
 modelId: string;
 executionEngine?: "api-chat" | "api-tools";
 supportsTools?: boolean;
 assignments: number;
 agentNames: string[];
 createdAt: string;
 updatedAt: string;
}

export interface StoredSettings {
 anthropicKey?: string;
 openaiKey?: string;
 anthropicBaseUrl?: string;
 openaiBaseUrl?: string;
 anthropicModel?: string;
 openaiModel?: string;
 rateLimit?: string;
 gateways?: Gateway[];
 defaultGatewayId?: string;
}

// ─── Socket Events ───────────────────────────────────────────────────

export interface ServerToClientEvents {
 "data:changed": () => void;
 "job:updated": (data:{jobId:string;status:string;error?:string})=>void;
 "activity:new": (activity: Activity) => void;
 "agent:status": (data: { agentId: string; status: AgentStatus }) => void;
 "task:updated": (task: Task) => void;
 "ci:update": (data: { taskId: string; ciStatus: CIStatus }) => void;
}

export interface ClientToServerEvents {
 "join:team": (teamId: string) => void;
 "leave:team": (teamId: string) => void;
}

// ─── Agent Memory ──────────────────────────────────────────────────────

export interface RoleGroup {
 id: string;
 name: string;
 subtitle: string;
 icon: string;
 instructionCount: number;
 skillCount: number;
 instructions: InstructionFile[];
 skills: Skill[];
 assignments: AgentAssignment[];
}

export interface InstructionFile {
 id: string;
 filename: string;
 title: string;
 description: string;
 content: string;
 updatedAt: string;
}

export interface Skill {
 id: string;
 name: string;
 level: string;
 description: string;
 updatedAt: string;
}

export interface AgentAssignment {
 agentId: string;
 agentName: string;
}
