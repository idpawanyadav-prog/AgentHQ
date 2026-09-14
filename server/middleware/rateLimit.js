/**
 * In-memory rate limiter.
 *
 * Applied to AI-proxy endpoints to prevent runaway API costs.
 * Each authenticated user gets a configurable window + max calls.
 */

const DEFAULT_WINDOW_MS = 60 * 1000; // 1 minute
const DEFAULT_MAX = 30; // 30 requests per minute per user

function createRateLimiter(opts = {}) {
 const windowMs = opts.windowMs || DEFAULT_WINDOW_MS;
 const maxRequests = opts.maxRequests || DEFAULT_MAX;
 const store = new Map();

 function cleanup() {
 const now = Date.now();
 for (const [key, value] of store) {
 if (now - value.resetAt > windowMs) store.delete(key);
 }
 }

 // Run cleanup every windowMs
 const cleanupTimer = setInterval(cleanup, windowMs);
 cleanupTimer.unref?.();

 return function rateLimit(req, res, next) {
 // Identify the caller — prefer user ID from JWT, fall back to IP.
 const key = req.user?.id || req.ip || 'anonymous';

 const now = Date.now();
 const record = store.get(key);

 if (!record || now - record.resetAt > windowMs) {
 store.set(key, { count: 1, resetAt: now });
 return next();
 }

 if (record.count >= maxRequests) {
 const retryAfter = Math.ceil((record.resetAt + windowMs - now) / 1000);
 return res.status(429).json({
 error: 'Rate limit exceeded',
 retryAfter,
 limit: maxRequests,
 windowMs,
 });
 }

 record.count += 1;
 next();
 };
}

module.exports = {
 createRateLimiter,
};
