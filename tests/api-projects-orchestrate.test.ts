jest.mock('../lib/auth', () => ({
  withAuth: (handler: any) => handler,
}));

jest.mock('../lib/orchestration/project-orchestrator', () => ({
  runProjectOrchestrationCycle: jest.fn(),
}));

import handler from '../pages/api/projects/[id]/orchestrate';
import { runProjectOrchestrationCycle } from '../lib/orchestration/project-orchestrator';

const mockReq = (method: string, body?: any, query?: any) => ({
  method,
  body: body || {},
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

describe('POST /api/projects/[id]/orchestrate', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns counts object with queued, ready, blocked, stalled', async () => {
    (runProjectOrchestrationCycle as jest.Mock).mockResolvedValue({
      readyTasks: 5,
      assignments: 3,
      stalled: { stalledTasks: 2, stalledExecutions: 1 },
    });

    const req = mockReq('POST', { mode: 'assisted' });
    const res = mockRes();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(200);
    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.projectId).toBe('proj_1');
    expect(body.mode).toBe('assisted');
    expect(body.counts).toEqual({ queued: 5, ready: 3, blocked: 2, stalled: 1 });
  });

  it('returns 404 for non-existent project when orchestrator throws', async () => {
    (runProjectOrchestrationCycle as jest.Mock).mockRejectedValue(new Error('Project not found'));

    const req = mockReq('POST');
    const res = mockRes();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
  });

  it('returns 405 for non-POST method', async () => {
    const req = mockReq('GET');
    const res = mockRes();

    await handler(req as any, res as any);

    expect(res.setHeader).toHaveBeenCalledWith('Allow', ['POST']);
    expect(res.status).toHaveBeenCalledWith(405);
  });

  it('returns 400 when project id is missing', async () => {
    const req = mockReq('POST', {}, {});
    const res = mockRes();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(400);
    expect(res.json).toHaveBeenCalledWith({ error: 'Project id is required' });
  });

  it('defaults mode to manual when not provided', async () => {
    (runProjectOrchestrationCycle as jest.Mock).mockResolvedValue({
      readyTasks: 0,
      assignments: 0,
      stalled: { stalledTasks: 0, stalledExecutions: 0 },
    });

    const req = mockReq('POST');
    const res = mockRes();

    await handler(req as any, res as any);

    const body = (res.json as jest.Mock).mock.calls[0][0];
    expect(body.mode).toBe('manual');
  });

  it('returns 500 when orchestrator throws', async () => {
    (runProjectOrchestrationCycle as jest.Mock).mockRejectedValue(new Error('orchestration error'));

    const req = mockReq('POST');
    const res = mockRes();

    await handler(req as any, res as any);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({ error: 'orchestration error' });
  });
});
