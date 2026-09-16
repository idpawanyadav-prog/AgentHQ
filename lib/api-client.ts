// API client for communicating with Express backend
const API_BASE = typeof window !== 'undefined' ? '' : '';

async function request(endpoint: string, options: RequestInit = {}) {
	const url = `${API_BASE}${endpoint}`;
	const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

	const headers: Record<string, string> = {
		'Content-Type': 'application/json',
		...(options.headers as Record<string, string> || {}),
	};

	if (token) {
		headers['Authorization'] = `Bearer ${token}`;
	}

	const response = await fetch(url, { ...options, headers });

	if (!response.ok) {
		const error = await response.json().catch(() => ({ message: 'Request failed' }));
		throw new Error(error.error || error.message || `HTTP ${response.status}`);
	}

	if (response.status === 204) return null;
 const result = await response.json();
 const data = result?.success === true ? result.data : result;
 function normalize(value: any): any {
  if (Array.isArray(value)) return value.map(normalize);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(Object.entries(value).map(([key, item]) => {
   if (['config', 'meta', 'dependencies'].includes(key) && typeof item === 'string') {
    try { return [key, JSON.parse(item)]; } catch { return [key, key === 'dependencies' ? [] : {}]; }
   }
   return [key, normalize(item)];
  }));
 }
 return normalize(endpoint.startsWith('/api/tasks') && data?.tasks ? data.tasks : data);
}

function buildQuery(params: Record<string, string | number | undefined>): string {
	const qs = new URLSearchParams();
	Object.entries(params).forEach(([k, v]) => {
		if (v !== undefined && v !== null && v !== '') qs.set(k, String(v));
	});
	const s = qs.toString();
	return s ? `?${s}` : '';
}

export const api = {
	// Teams
	getTeams: () => request('/api/teams'),
	getTeam: (id: string) => request(`/api/teams/${id}`),
	createTeam: (data: { name: string; description?: string; status?: string }) =>
		request('/api/teams', {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateTeam: (id: string, data: { name?: string; description?: string; status?: string }) =>
		request(`/api/teams/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		}),
	deleteTeam: (id: string) =>
		request(`/api/teams/${id}`, { method: 'DELETE' }),

	// Tasks
	getTasks: (params?: {
		teamId?: string;
		status?: string;
		projectId?: string;
		sprintId?: string;
		assigneeId?: string;
		search?: string;
	}) => request(`/api/tasks${buildQuery(params || {})}`),
	getTask: (id: string) => request(`/api/tasks/${id}`),
	createTask: (data: {
		title: string;
		description?: string;
		priority?: string;
		status?: string;
		teamId: string;
		projectId?: string;
		sprintId?: string;
		type?: string;
		storyPoints?: number;
		dueDate?: string;
		acceptanceCriteria?: { text: string; done: boolean }[];
		blocked?: boolean;
		blockedReason?: string;
		assigneeId?: string;
		agentId?: string;
	}) =>
		request('/api/tasks', {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateTask: (id: string, data: Record<string, unknown>) =>
		request(`/api/tasks/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		}),
	deleteTask: (id: string) =>
		request(`/api/tasks/${id}`, { method: 'DELETE' }),
	updateTaskStatus: (id: string, status: string, blockedReason?: string) =>
		request(`/api/tasks/${id}/status`, {
			method: 'POST',
			body: JSON.stringify(
				blockedReason ? { status, blockedReason } : { status },
			),
		}),
	assignTask: (id: string, assigneeId?: string, agentId?: string) => {
		const body: Record<string, unknown> = { assigneeId: assigneeId || null, agentId: agentId || null };
		if (assigneeId) body.assigneeId = assigneeId;
		if (agentId) body.agentId = agentId;
		return request(`/api/tasks/${id}/assign`, {
			method: 'POST',
			body: JSON.stringify(body),
		});
	},

	// Agents
	getAgents: (teamId?: string) =>
		request(`/api/agents${teamId ? `?teamId=${teamId}` : ''}`),
	getAgent: (id: string) => request(`/api/agents/${id}`),
	createAgent: (data: {
		name: string;
		type: string;
		model: string;
		memberId?: string;
		teamId?: string;
		config?: Record<string, any>;
	}) =>
		request('/api/agents', {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateAgent: (id: string, data: {
		name?: string;
		type?: string;
		model?: string;
		teamId?: string | null;
		config?: Record<string, any>;
		status?: string;
	}) =>
		request(`/api/agents/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		}),
	deleteAgent: (id: string) =>
		request(`/api/agents/${id}`, { method: 'DELETE' }),
	benchAgent: (id: string) =>
		request(`/api/agents/${id}`, {
			method: 'PUT',
			body: JSON.stringify({ teamId: null }),
		}),
	startAgent: (id: string, taskId: string) =>
		request(`/api/agents/${id}/start`, {
			method: 'POST',
			body: JSON.stringify({ taskId }),
		}),
	stopAgent: (id: string) =>
		request(`/api/agents/${id}/stop`, { method: 'POST' }),
	chatAgent: (id: string, data: { message: string; history?: Array<{ role: 'user' | 'assistant'; content: string }> }) =>
		request(`/api/agents/${id}/chat`, {
			method: 'POST',
			body: JSON.stringify(data),
		}),

	getActivities: (teamId?: string, limit = 50) =>
		request(`/api/activity?limit=${limit}${teamId ? `&teamId=${teamId}` : ''}`),

	// Projects
	getProjects: () => request('/api/projects'),
	getProject: (id: string) => request(`/api/projects/${id}`),
	getProjectMilestones: (id: string) => request(`/api/projects/${id}/milestones`),
	createProject: (data: { name: string; description?: string; teamId: string; repoUrl?: string }) =>
		request('/api/projects', {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateProject: (id: string, data: { name?: string; description?: string; status?: string; progress?: number }) =>
		request(`/api/projects/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		}),
	deleteProject: (id: string) =>
		request(`/api/projects/${id}`, { method: 'DELETE' }),

	// Sprints
	getSprints: (params?: { teamId?: string; projectId?: string }) =>
		request(`/api/sprints${buildQuery(params || {})}`),
	createSprint: (data: { name: string; goal?: string; projectId?: string; teamId?: string }) =>
		request('/api/sprints', {
			method: 'POST',
			body: JSON.stringify(data),
		}),

	// Models
	getModels: () => request('/api/models'),
	createModel: (data: { name: string; gatewayId: string; gatewayName: string; provider: string; modelId: string }) =>
		request('/api/models', {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateModel: (id: string, data: { name: string; gatewayId: string; gatewayName: string; provider: string; modelId: string }) =>
		request('/api/models', {
			method: 'PUT',
			body: JSON.stringify({ id, ...data }),
		}),
	deleteModel: (id: string) =>
		request('/api/models', {
			method: 'DELETE',
			body: JSON.stringify({ id }),
		}),

	// Settings
	getSettings: () => request('/api/settings'),
	updateSettings: (data: Record<string, string>) =>
		request('/api/settings', {
			method: 'PUT',
			body: JSON.stringify(data),
		}),

	// Cost & Usage
	getCost: () => request('/api/cost'),

	// Agent Memory
	getRoleGroups: () => request('/api/agent-memory'),
	getRoleGroup: (id: string) => request(`/api/agent-memory/role-groups/${id}`),
	createRoleGroup: (data: { name: string; description?: string; color?: string }) =>
		request('/api/agent-memory', {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateRoleGroup: (id: string, data: { name?: string; description?: string; color?: string }) =>
		request(`/api/agent-memory/role-groups/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		}),
	deleteRoleGroup: (id: string) =>
		request(`/api/agent-memory/role-groups/${id}`, { method: 'DELETE' }),
	createInstruction: (groupId: string, data: { filename: string; title?: string; content: string }) =>
		request(`/api/agent-memory/role-groups/${groupId}/instructions`, {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateInstruction: (instructionId: string, data: { filename?: string; title?: string; content?: string }) =>
		request(`/api/agent-memory/instructions/${instructionId}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		}),
	deleteInstruction: (instructionId: string) =>
		request(`/api/agent-memory/instructions/${instructionId}`, { method: 'DELETE' }),
	createSkill: (groupId: string, data: { name: string; level?: string; description?: string }) =>
		request(`/api/agent-memory/role-groups/${groupId}/skills`, {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateSkill: (skillId: string, data: { name?: string; level?: string; description?: string }) =>
		request(`/api/agent-memory/skills/${skillId}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		}),
	deleteSkill: (skillId: string) =>
		request(`/api/agent-memory/skills/${skillId}`, { method: 'DELETE' }),
	assignAgent: (groupId: string, data: { agentId: string; agentName: string; agentStatus?: string }) =>
		request(`/api/agent-memory/role-groups/${groupId}/assignments`, {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	removeAssignment: (groupId: string, agentId: string) =>
		request(`/api/agent-memory/role-groups/${groupId}/assignments/${agentId}`, { method: 'DELETE' }),

	// Members
	deleteMember: (id: string) => request(`/api/members/${id}`, { method: 'DELETE' }),
	createMember: (data: { name: string; role: string; type: "human" | "ai"; teamId: string }) =>
		request('/api/members', {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateMember: (id: string, data: { name?: string; role?: string; type?: "human" | "ai"; teamId?: string }) =>
		request(`/api/members/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		}),
};

export default api;
