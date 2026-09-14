/** @type {import('next').NextConfig} */

const isProd = process.env.NODE_ENV === 'production';

const csp = [
 `default-src 'self'`,
 `script-src 'self' 'unsafe-inline' 'unsafe-eval'`,
 `style-src 'self' 'unsafe-inline'`,
 `img-src 'self' data: https:`,
 `font-src 'self' data:`,
 `connect-src 'self' ws: wss: https:`,
 `frame-ancestors 'none'`,
 `base-uri 'self'`,
 `form-action 'self'`,
].join('; ');

const nextConfig = {
 reactStrictMode: true,
 outputFileTracingRoot: __dirname,
 distDir: process.env.NODE_ENV === 'production' ? '.next-production' : '.next',
 images: {
 domains: ['avatars.githubusercontent.com', 'github.com'],
 },
 async headers() {
 const headers = [
 {
 key: 'Content-Security-Policy',
 value: csp,
 },
 { key: 'X-Content-Type-Options', value: 'nosniff' },
 { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
 { key: 'X-Frame-Options', value: 'DENY' },
 { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
 ];
 if (isProd) {
 headers.push({ key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains' });
 }
 return [{
 source: '/:path*',
 headers,
 }];
 },
};

module.exports = nextConfig;
