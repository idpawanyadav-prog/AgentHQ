// Security headers middleware
// Add to app.use before routes

const helmet = {
 'content-security-policy': {
 'directives': {
 'default-src': ["'self'"],
 'frame-ancestors': ["'none'"],
 'form-action': ["'self'"],
 'upgrade-insecure-requests': process.env.NODE_ENV === 'production' ? [] : null,
 'img-src': ["'self'", 'data:', 'https:'],
 'script-src': ["'self'"],
 'style-src': ["'self'", "'unsafe-inline'"],
 'connect-src': ["'self'", 'ws:', 'wss:'],
 },
 'reportOnly': process.env.NODE_ENV !== 'production',
 },
 'x-content-type-options': 'nosniff',
 'x-frame-options': 'DENY',
 'x-xss-protection': '0',
 'strict-transport-security': process.env.NODE_ENV === 'production'
 ? 'max-age=63072000; includeSubDomains; preload'
 : undefined,
};

function securityHeaders(req, res, next) {
 const csp = helmet['content-security-policy'];
 const reportOnly = csp?.reportOnly || false;
 const directives = Object.entries(csp.directives)
 .filter(([, v]) => v !== null)
 .map(([k, v]) => `${k} ${(Array.isArray(v) ? v : [v]).join(' ')}`)
 .join('; ');

 if (directives) {
 res.setHeader('Content-Security-Policy', reportOnly ? `${directives}` : `${directives}`);
 res.setHeader('X-Content-Type-Options', helmet['x-content-type-options']);
 res.setHeader('X-Frame-Options', helmet['x-frame-options']);
 res.setHeader('X-XSS-Protection', helmet['x-xss-protection']);
 if (helmet['strict-transport-security']) {
 res.setHeader('Strict-Transport-Security', helmet['strict-transport-security']);
 }
 }
 next();
}

module.exports = securityHeaders;
