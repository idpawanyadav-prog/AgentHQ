import type { AgentToolDefinition, AgentToolContext } from './types';

const registry = new Map<string, AgentToolDefinition>();

export function registerAgentTool(tool: AgentToolDefinition): void {
  if (registry.has(tool.name)) {
    throw new Error(`Tool already registered: ${tool.name}`);
  }
  registry.set(tool.name, tool);
}

export function getAgentTool(name: string): AgentToolDefinition | null {
  return registry.get(name) || null;
}

export function listAgentTools(): AgentToolDefinition[] {
  return Array.from(registry.values());
}

export function hasAgentTool(name: string): boolean {
  return registry.has(name);
}

export function clearAgentTools(): void {
  registry.clear();
}

export function toolNamesByActor(context: AgentToolContext): string[] {
  return listAgentTools()
    .filter((tool) => tool.allowedActors.includes(context.actorType))
    .map((tool) => tool.name);
}
