import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProjectControlPage from '../pages/project-control';

const mockGetProjects = jest.fn();
const mockGetProjectControlStatus = jest.fn();
const mockGetProjectGovernance = jest.fn();
const mockGetSquads = jest.fn();
const mockGetProject = jest.fn();
const mockChatProjectControl = jest.fn();
const mockProposeStaffing = jest.fn();
const mockProposeExecution = jest.fn();
const mockApproveExecution = jest.fn();
const mockApplyStaffing = jest.fn();
const mockUpdateProjectGovernance = jest.fn();

jest.mock('../lib/api-client', () => ({
	__esModule: true,
	default: {
		getProjects: jest.fn(() => mockGetProjects()),
		getProjectControlStatus: jest.fn(() => mockGetProjectControlStatus()),
		getProjectGovernance: jest.fn(() => mockGetProjectGovernance()),
		getSquads: jest.fn(() => mockGetSquads()),
		getProject: jest.fn(() => mockGetProject()),
		chatProjectControl: jest.fn(() => mockChatProjectControl()),
		proposeStaffing: jest.fn(() => mockProposeStaffing()),
		proposeExecution: jest.fn(() => mockProposeExecution()),
		approveExecution: jest.fn(() => mockApproveExecution()),
		applyStaffing: jest.fn(() => mockApplyStaffing()),
		updateProjectGovernance: jest.fn(() => mockUpdateProjectGovernance()),
	},
}));

beforeEach(() => {
	jest.clearAllMocks();
	mockGetProjects.mockResolvedValue([{ id: 'project-1', name: 'Customer Portal', status: 'active' }]);
	mockGetProjectControlStatus.mockResolvedValue({
		project: { id: 'project-1', name: 'Customer Portal', status: 'active', progress: 42, repositoryMode: 'none', repositoryStatus: 'unconfigured', defaultBranch: 'main' },
		team: { id: 'team-1', name: 'Portal Team', agentCount: 1 },
		agents: [],
		taskCounts: {},
		summary: { openTaskCount: 0, blockedTaskCount: 0, idleAgentCount: 0, workingAgentCount: 0, reviewQueueCount: 0 },
		activeSprint: null,
		tasks: [],
		milestones: [],
		risks: [],
	});
	mockGetProjectGovernance.mockResolvedValue({ humanDirectives: '', allowShell: false, allowRemotePush: false, allowAutoPr: false });
	mockGetSquads.mockResolvedValue([]);
	mockGetProject.mockResolvedValue({ executionRuns: [] });
	mockChatProjectControl.mockResolvedValue({ reply: 'Hello' });
	mockProposeStaffing.mockResolvedValue(null);
	mockProposeExecution.mockResolvedValue(null);
	mockApproveExecution.mockResolvedValue({});
	mockApplyStaffing.mockResolvedValue({});
	mockUpdateProjectGovernance.mockResolvedValue({});
});

it('shows Project selector and Chat when projects exist', async () => {
	render(<ProjectControlPage />);

	await screen.findByDisplayValue('Customer Portal');
	expect(screen.getByText('Project Control Chat')).toBeInTheDocument();
	expect(screen.getByPlaceholderText(/Ask Project Control/)).toBeInTheDocument();
});

it('shows "Create a Project first" when no projects exist', async () => {
	mockGetProjects.mockResolvedValue([]);
	render(<ProjectControlPage />);

	await screen.findByText('Create a Project first.');
	expect(screen.getByText('Project Control Chat')).toBeInTheDocument();
});

it('sends a chat message without requiring a projectId', async () => {
	render(<ProjectControlPage />);

	await screen.findByDisplayValue('Customer Portal');
	const input = screen.getByPlaceholderText(/Ask Project Control/);
	fireEvent.change(input, { target: { value: 'Hello' } });
	fireEvent.submit(input.closest('form')!);

	await waitFor(() => expect(mockChatProjectControl).toHaveBeenCalled());
});
