const { createRateLimiter } = require('../server/middleware/rateLimit');

function createResponse() {
 return {
  statusCode: 200,
  body: undefined as unknown,
  status(code: number) {
   this.statusCode = code;
   return this;
  },
  json(payload: unknown) {
   this.body = payload;
   return this;
  },
 };
}

describe('AI rate limiter middleware', () => {
 it('returns 429 with retry information when the caller exceeds the limit', () => {
  const limiter = createRateLimiter({ windowMs: 60_000, maxRequests: 2 });
  const req = { user: { id: 'user-1' }, ip: '127.0.0.1' };
  const next = jest.fn();

  const first = createResponse();
  limiter(req, first, next);

  const second = createResponse();
  limiter(req, second, next);

  const third = createResponse();
  expect(() => limiter(req, third, next)).not.toThrow();

  expect(next).toHaveBeenCalledTimes(2);
  expect(third.statusCode).toBe(429);
  expect(third.body).toMatchObject({
   error: 'Rate limit exceeded',
   retryAfter: expect.any(Number),
   limit: 2,
   windowMs: 60_000,
  });
 });
});
