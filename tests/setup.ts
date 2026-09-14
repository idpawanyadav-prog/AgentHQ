import "@testing-library/jest-dom";
import React from "react";

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
