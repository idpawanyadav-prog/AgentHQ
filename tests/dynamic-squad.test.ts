jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		project: { findUnique: jest.fn() },
	},
}));

const prisma = jest.requireMock('../lib/prisma').default;

import { proposeSquad } from '../lib/squads/squad-planner';

it('selects only relevant available Agents for a payment auth requirement', async () => {
	prisma.project.findUnique.mockResolvedValue({
		id: 'project-1',
		name: 'Portal',
		team: {
			members: [
				{ role: 'Frontend Developer', agents: [{ id: 'front-1', name: 'Front', status: 'idle', tasks: [] }] },
				{ role: 'Backend Developer', agents: [{ id: 'back-1', name: 'Back', status: 'idle', tasks: [] }] },
				{ role: 'QA Engineer', agents: [{ id: 'qa-1', name: 'QA', status: 'idle', tasks: [] }] },
				{ role: 'Security Reviewer', agents: [{ id: 'sec-1', name: 'Sec', status: 'idle', tasks: [] }] },
			],
		},
	});

	const proposal = await proposeSquad('project-1', { requirement: 'Implement payment authentication with regression tests' });
	expect(proposal.members.map((member) => member.role)).toEqual(['Backend Developer', 'QA Engineer']);
	expect(proposal.members).toHaveLength(2);
	expect(proposal.missingRoles).toEqual([]);
});
