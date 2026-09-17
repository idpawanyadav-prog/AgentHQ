import type { AgentToolDefinition } from './types';

type SchemaProperty = {
  type?: string;
  properties?: Record<string, SchemaProperty>;
  required?: string[];
  items?: SchemaProperty;
  enum?: unknown[];
};

export function validateToolArguments(
  schema: Record<string, unknown>,
  args: Record<string, unknown>,
): Record<string, unknown> {
  if (typeof schema !== 'object' || schema === null || Array.isArray(schema)) {
    throw new Error('Invalid tool schema');
  }

  const type = (schema as SchemaProperty).type;
  if (type && type !== 'object') {
    throw new Error(`Expected object arguments, got ${type}`);
  }

  if (typeof args !== 'object' || args === null || Array.isArray(args)) {
    throw new Error('Arguments must be an object');
  }

  const properties = (schema as SchemaProperty).properties as Record<string, SchemaProperty> | undefined;
  const required = (schema as SchemaProperty).required as string[] | undefined;

  if (required && Array.isArray(required)) {
    for (const field of required) {
      if (!(field in args)) {
        throw new Error(`Missing required argument: ${field}`);
      }
    }
  }

  const validated: Record<string, unknown> = {};
  if (properties) {
    for (const [key, prop] of Object.entries(properties)) {
      if (!(key in args)) continue;
      const value = args[key];
      validated[key] = validateProperty(value, prop, key);
    }
  }
  for (const [key, value] of Object.entries(args)) {
    if (!(key in validated)) {
      validated[key] = value;
    }
  }

  return validated;
}

function validateProperty(value: unknown, prop: SchemaProperty, path: string): unknown {
  if (prop.enum && Array.isArray(prop.enum)) {
    if (!prop.enum.includes(value)) {
      throw new Error(`Invalid value for ${path}: ${JSON.stringify(value)}. Must be one of: ${prop.enum.join(', ')}`);
    }
    return value;
  }

  const expectedType = prop.type;
  if (!expectedType) return value;

  const typeOk =
    (expectedType === 'string' && typeof value === 'string') ||
    (expectedType === 'number' && typeof value === 'number' && Number.isFinite(value)) ||
    (expectedType === 'integer' && Number.isInteger(value)) ||
    (expectedType === 'boolean' && typeof value === 'boolean') ||
    (expectedType === 'array' && Array.isArray(value)) ||
    (expectedType === 'object' && typeof value === 'object' && value !== null && !Array.isArray(value)) ||
    (expectedType === 'null' && value === null);

  if (!typeOk) {
    throw new Error(`Invalid type for ${path}: expected ${expectedType}, got ${typeof value}`);
  }

  if (expectedType === 'object' && prop.properties) {
    const nested: Record<string, unknown> = {};
    for (const [k, p] of Object.entries(prop.properties)) {
      if (k in (value as Record<string, unknown>)) {
        nested[k] = validateProperty((value as Record<string, unknown>)[k], p, `${path}.${k}`);
      }
    }
    return nested;
  }

  if (expectedType === 'array' && prop.items) {
    return (value as unknown[]).map((item, i) => validateProperty(item, prop.items!, `${path}[${i}]`));
  }

  return value;
}

export function getRequiredFields(tool: AgentToolDefinition): string[] {
  return (tool.inputSchema.required as string[] | undefined) || [];
}
