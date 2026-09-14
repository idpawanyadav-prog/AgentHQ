/** @type {import('next').NextConfig} */
const nextConfig = {
	reactStrictMode: true,
 distDir: process.env.NODE_ENV === 'production' ? '.next-production' : '.next',
	images: {
		domains: ['avatars.githubusercontent.com', 'github.com'],
	},
};

module.exports = nextConfig;
