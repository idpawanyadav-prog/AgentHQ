const jwt = require('jsonwebtoken');

/**
 * JWT auth middleware.
 * Verifies the Bearer token in the Authorization header and attaches
 * the decoded payload to req.user.
 *
 * For NextAuth integration, also accepts the NextAuth session JWT cookie
 * when the Authorization header is missing (used by Next.js API routes).
 */
const JWT_SECRET = process.env.JWT_SECRET || 'dev-insecure-secret-change-me';

function authMiddleware(req, res, next) {
 const authHeader = req.headers.authorization || '';
 const bearerToken = authHeader.startsWith('Bearer ')
 ? authHeader.slice(7)
 : null;

 const token = bearerToken || req.cookies?.['next-auth.session-token'];

 if (!token) {
 return res.status(401).json({ error: 'Authentication required' });
 }

 try {
 const decoded = jwt.verify(token, JWT_SECRET);
 req.user = decoded;
 return next();
 } catch (err) {
 return res.status(401).json({ error: 'Invalid or expired token' });
 }
}

/**
 * Optional auth — populates req.user if a valid token is present,
 * but allows the request through if not. Useful for endpoints that
 * work both authenticated and anonymously.
 */
function optionalAuth(req, _res, next) {
 const authHeader = req.headers.authorization || '';
 const bearerToken = authHeader.startsWith('Bearer ')
 ? authHeader.slice(7)
 : null;

 const token = bearerToken || req.cookies?.['next-auth.session-token'];

 if (!token) return next();

 try {
 req.user = jwt.verify(token, JWT_SECRET);
 } catch (_err) {
 // Ignore — treat as anonymous.
 }
 return next();
}

/**
 * Admin-only guard. Use after authMiddleware.
 */
function requireAdmin(req, res, next) {
 if (!req.user) return res.status(401).json({ error: 'Authentication required' });
 if (req.user.role !== 'admin') {
 return res.status(403).json({ error: 'Admin role required' });
 }
 return next();
}

module.exports = {
 authMiddleware,
 optionalAuth,
 requireAdmin,
};
