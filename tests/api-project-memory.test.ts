jest.mock('../lib/auth', () => ({
	withAuth: (handler: any) => handler,
}));

jest.mock('../lib/prisma', () => ({
	__esModule: true,
	default: {
		projectMemory: { findUnique: jest.fn() },
	},
}));

import handler from '../pages/api/projects/[id]/memory';
import prisma from '../lib/prisma';

const mockReq = (method: string, query?: any) => ({
	method,
	query: query || { id: 'proj_1' },
	cookies: { dashboard_session: 'valid.session.token' },
	headers: { host: 'localhost:3000', origin: 'http://localhost:3000' },
});

const mockRes = () => {
	const res: any = {};
	res.status = jest.fn(() => res);
	res.json = jest.fn(() => res);
	res.setHeader = jest.fn();
	res.end = jest.fn();
	return res;
};

describe('GET /api/projects/[id]/memory', () => {
	beforeEach(() => {
		jest.clearAllMocks();
	});

	it('returns ProjectMemory when exists', async () => {
		const memory = {
			id: 'mem_1',
			projectId: 'proj_1',
			mission: 'Build something cool',
			productSummary: 'A product',
			architecture: 'microservices',
			techStack: 'TypeScript, Next.js',
			currentPhase: 'building',
			completedWork: 'Setup',
			keyDecisions: 'Use Prisma',
			knownRisks: 'Time pressure',
			blockers: 'None',
			nextActions: 'Implement auth',
			openQuestions: 'OAuth or custom?',
			version: 1,
			createdAt: new Date(),
			updatedAt: new Date(),
		};

		(prisma.projectMemory.findUnique as jest.Mock).mockResolvedValue(memory);

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(200);
		const body = (res.json as jest.Mock).mock.calls[0][0];
		expect(body.projectId).toBe('proj_1');
		expect(body.mission).toBe('Build something cool');
		expect(body.architecture).toBe('microservices');
		expect(body.currentPhase).toBe('building');
	});

	it('returns error when no memory exists', async () => {
		(prisma.projectMemory.findUnique as jest.Mock).mockResolvedValue(null);

		const req = mockReq('GET', { id: 'proj_no_memory' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(404);
		expect(res.json).toHaveBeenCalledWith({ error: 'No project memory found' });
	});

	it('returns 405 for non-GET method', async () => {
		const req = mockReq('POST', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.setHeader).toHaveBeenCalledWith('Allow', ['GET']);
		expect(res.status).toHaveBeenCalledWith(405);
	});

	it('returns 400 when project id is missing', async () => {
		const req = mockReq('GET', {});
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(400);
		expect(res.json).toHaveBeenCalledWith({ error: 'Project id is required' });
	});

	it('returns 500 when prisma throws', async () => {
		(prisma.projectMemory.findUnique as jest.Mock).mockRejectedValue(new Error('db error'));

		const req = mockReq('GET', { id: 'proj_1' });
		const res = mockRes();

		await handler(req as any, res as any);

		expect(res.status).toHaveBeenCalledWith(500);
		expect(res.json).toHaveBeenCalledWith({ error: 'Failed to fetch project memory' });
	});
});
