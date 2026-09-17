import type { PrismaClient } from '@prisma/client';

type AnyQuery = (...args: any[]) => any;

function createModel() {
	const calls = new Map<string, jest.Mock>();
	return new Proxy({}, {
		get(_target, prop: string) {
			if (!calls.has(prop)) {
				calls.set(prop, jest.fn(() => Promise.resolve({})));
			}
			return calls.get(prop);
		},
		getOwnPropertyDescriptor() {
			return { configurable: true, enumerable: true };
		},
	}) as unknown as Record<string, AnyQuery>;
}

const createMockPrisma = (): any => ({
	project: createModel(),
	team: createModel(),
	member: createModel(),
	agent: createModel(),
	task: createModel(),
	sprint: createModel(),
	milestone: createModel(),
	activity: createModel(),
	gateway: createModel(),
	roleGroup: createModel(),
	agentRoleAssignment: createModel(),
	workspace: createModel(),
	job: createModel(),
	executionProposal: createModel(),
	executionRun: createModel(),
	projectMemory: createModel(),
	taskMemory: createModel(),
	agentMemory: createModel(),
	decisionRecord: createModel(),
	handoffRecord: createModel(),
	taskReview: createModel(),
	sprintSummary: createModel(),
	sprintRetrospective: createModel(),
	executionCheckpoint: createModel(),
	executionToolEvent: createModel(),
	projectGovernance: createModel(),
	projectIssue: createModel(),
	dynamicSquad: createModel(),
	squadMember: createModel(),
	projectExecutionState: createModel(),
	setting: createModel(),
	$connect: jest.fn(),
	$disconnect: jest.fn(),
	$transaction: jest.fn(async (cb: any) => cb({})),
});

const instance = createMockPrisma();
export default instance;
