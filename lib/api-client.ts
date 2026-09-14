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
	createTeam: (data: { name: string; description?: string }) =>
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
		memberId: string;
		config?: Record<string, any>;
	}) =>
		request('/api/agents', {
			method: 'POST',
			body: JSON.stringify(data),
		}),
	updateAgent: (id: string, data: {
		name?: string;
		model?: string;
		config?: Record<string, any>;
		status?: string;
	}) =>
		request(`/api/agents/${id}`, {
			method: 'PUT',
			body: JSON.stringify(data),
		}),
	startAgent: (id: string, taskId: string) =>
		request(`/api/agents/${id}/start`, {
			method: 'POST',
			body: JSON.stringify({ taskId }),
		}),
	stopAgent: (id: string) =>
		request(`/api/agents/${id}/stop`, { method: 'POST' }),

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

	// Settings
	getSettings: () => request('/api/settings'),
	updateSettings: (data: Record<string, string>) =>
		request('/api/settings', {
			method: 'PUT',
			body: JSON.stringify(data),
		}),

	// Cost & Usage
	getCost: () => request('/api/cost'),
};

export default api;
