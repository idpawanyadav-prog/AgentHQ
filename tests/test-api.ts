import type { NextApiRequest, NextApiResponse } from 'next';

export function mockReq(options: Partial<NextApiRequest> = {}) {
	return {
		method: 'GET',
		query: {},
		body: {},
		headers: {},
		cookies: {},
		...options,
	} as NextApiRequest;
}

export function mockRes() {
	const res = {
		statusCode: 200,
		headers: {} as Record<string, unknown>,
		body: undefined as unknown,
		status: jest.fn((code: number) => {
			res.statusCode = code;
			return res;
		}),
		json: jest.fn((body: unknown) => {
			res.body = body;
			return res;
		}),
		end: jest.fn((body?: unknown) => {
			res.body = body;
			return res;
		}),
		setHeader: jest.fn((key: string, value: unknown) => {
			res.headers[key] = value;
			return res;
		}),
	} as unknown as NextApiResponse & {
		statusCode: number;
		body: unknown;
		headers: Record<string, unknown>;
		status: jest.Mock;
		json: jest.Mock;
		end: jest.Mock;
		setHeader: jest.Mock;
	};
	return res;
}
