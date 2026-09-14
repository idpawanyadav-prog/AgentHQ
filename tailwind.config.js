/** @type {import('tailwindcss').Config} */
module.exports = {
 content: [
 './pages/**/*.{js,ts,jsx,tsx,mdx}',
 './components/**/*.{js,ts,jsx,tsx,mdx}',
 './app/**/*.{js,ts,jsx,tsx,mdx}',
 ],
 theme: {
 extend: {
 colors: {
 primary: {
 DEFAULT: '#6366f1',
 50: '#eef2ff',
 100: '#e0e7ff',
 500: '#6366f1',
 600: '#4f46e5',
 700: '#4338ca',
 },
 slate: {
 850: '#1a1f2e',
 900: '#0f172a',
 950: '#080d1a',
 },
 accent: {
 anthropic: '#d4a574',
 openai: '#74b4d4',
 },
 },
 },
 },
 plugins: [],
};
