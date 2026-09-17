import "@testing-library/jest-dom";
import React from "react";

// Polyfill for jsdom environment missing TextEncoder/TextDecoder
if (typeof global.TextEncoder === "undefined") {
	const { TextEncoder, TextDecoder } = require("util");
	global.TextEncoder = TextEncoder as any;
	global.TextDecoder = TextDecoder as any;
}

// Load environment variables
try { require("dotenv").config(); } catch {}

// Mock next/router
jest.mock("next/router", () => ({
 useRouter: () => ({
 pathname: "/",
 }),
}));

// Mock next/link
jest.mock("next/link", () => {
 return ({ children, href, ...props }: any) => {
 return React.createElement("a", { href, ...props }, children);
 };
});
