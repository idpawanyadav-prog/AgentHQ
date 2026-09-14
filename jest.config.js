/** @type {import('jest').Config} */
const config = {
 testEnvironment: "jsdom",
 roots: ["<rootDir>/tests", "<rootDir>/pages", "<rootDir>/components"],
 testMatch: ["**/*.test.ts", "**/*.test.tsx"],
 moduleFileExtensions: ["ts", "tsx", "js", "jsx", "json"],
 transform: {
 "^.+\\.(ts|tsx)$": ["ts-jest", { useESM: false, tsconfig: { jsx: "react-jsx" } }],
 },
 setupFilesAfterEnv: ["<rootDir>/tests/setup.ts"],
 collectCoverageFrom: [
 "components/**/*.{ts,tsx}",
 "pages/**/*.{ts,tsx}",
 "!**/*.d.ts",
 ],
 coverageThreshold: {
 global: {
 branches: 50,
 functions: 50,
 lines: 50,
 statements: 50,
 },
 },
};

module.exports = config;
