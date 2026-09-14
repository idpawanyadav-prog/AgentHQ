import React from "react";
import { render, screen } from "@testing-library/react";
import StatCard from "../components/StatCard";

describe("StatCard", () => {
 it("renders label and value", () => {
 render(
 <StatCard label="Teams" value="3" icon={<span data-testid="icon">icon</span>} />
 );
 expect(screen.getByText("Teams")).toBeDefined();
 expect(screen.getByText("3")).toBeDefined();
 });

 it("renders trend when provided", () => {
 render(
 <StatCard
 label="Tasks"
 value="5"
 icon={<span data-testid="icon">icon</span>}
 trend={{ value: 10, label: "vs last week" }}
 />
 );
 expect(screen.getByText("+10 vs last week")).toBeDefined();
 });

 it("renders negative trend", () => {
 render(
 <StatCard
 label="Errors"
 value="2"
 icon={<span data-testid="icon">icon</span>}
 trend={{ value: 5, label: "vs last week", positive: false }}
 />
 );
 expect(screen.getByText("-5 vs last week")).toBeDefined();
 });

 it("renders icon element", () => {
 render(
 <StatCard
 label="Test"
 value="1"
 icon={<span data-testid="custom-icon">custom</span>}
 />
 );
 expect(screen.getByTestId("custom-icon")).toBeDefined();
 });
});
