
export function createMockPrisma() {
  const mockFn = (data: any = []) => ({
    findMany: jest.fn().mockResolvedValue(data),
    findUnique: jest.fn().mockResolvedValue(null),
    findFirst: jest.fn().mockResolvedValue(null),
    create: jest.fn().mockResolvedValue({ id: 'mock-1' }),
    update: jest.fn().mockResolvedValue({}),
    updateMany: jest.fn().mockResolvedValue({ count: 0 }),
    upsert: jest.fn().mockResolvedValue({}),
    count: jest.fn().mockResolvedValue(0),
    $transaction: jest.fn(async (cb: any) => cb({
      task: { update: jest.fn().mockResolvedValue({}) },
      agent: { update: jest.fn().mockResolvedValue({}) },
      job: { create: jest.fn().mockResolvedValue({ id: 'mock-job' }) },
    })),
  });

  return {
    task: mockFn(),
    agent: mockFn(),
    job: mockFn(),
    executionRun: mockFn(),
    executionCheckpoint: mockFn(),
    projectExecutionState: mockFn(),
    activity: mockFn(),
    project: mockFn(),
    team: mockFn(),
    member: mockFn(),
    sprint: mockFn(),
    projectMemory: mockFn(),
    $connect: jest.fn(),
    $disconnect: jest.fn(),
  };
}
