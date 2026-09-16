import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import ProjectControlPage from '../pages/project-control';

jest.mock('../lib/api-client', () => ({
	__esModule: true,
	default: {
		getProjects: jest.fn().mockResolvedValue([{ id: 'project-1', name: 'Customer Portal', status: 'active' }]),
		getProjectControlStatus: jest.fn().mockResolvedValue({
			project: { id: 'project-1', name: 'Customer Portal', status: 'active', progress: 42, repositoryMode: 'none', repositoryStatus: 'unconfigured', defaultBranch: 'main' },
			team: { id: 'team-1', name: 'Portal Team', agentCount: 1 },
			agents: [],
			taskCounts: {},
			summary: { openTaskCount: 0, blockedTaskCount: 0, idleAgentCount: 0, workingAgentCount: 0, reviewQueueCount: 0 },
			activeSprint: null,
			tasks: [],
			milestones: [],
			risks: [],
		}),
		getProjectGovernance: jest.fn().mockResolvedValue({ humanDirectives: '', allowShell: false, allowRemotePush: false, allowAutoPr: false }),
		getSquads: jest.fn().mockResolvedValue([]),
		getProject: jest.fn().mockResolvedValue({ executionRuns: [] }),
	},
}));

it('hides Project dropdown until Existing project is selected and then scopes chat to that Project', async () => {
	render(<ProjectControlPage />);

	await screen.findByLabelText('Existing project');
	expect(screen.queryByDisplayValue('project-1')).toBeNull();
	expect(screen.getByText('Select Existing project to bind chat and execution controls to one Project.')).toBeInTheDocument();

	fireEvent.click(screen.getByLabelText('Existing project'));

	await waitFor(() => expect(screen.getByDisplayValue('Customer Portal')).toBeInTheDocument());
	await waitFor(() => expect(screen.getByText('Progress')).toBeInTheDocument());
});
