import { validateToolArguments } from '../lib/agent-tools/validation';

describe('validateToolArguments', () => {
  const schema = {
    type: 'object' as const,
    properties: {
      projectId: { type: 'string' },
      count: { type: 'integer' },
      tags: { type: 'array', items: { type: 'string' } },
      meta: { type: 'object', properties: { priority: { type: 'string' } } },
      active: { type: 'boolean' },
    },
    required: ['projectId'],
  };

  it('passes valid arguments', () => {
    const result = validateToolArguments(schema, { projectId: 'proj-1', count: 3, active: true });
    expect(result.projectId).toBe('proj-1');
    expect(result.count).toBe(3);
    expect(result.active).toBe(true);
  });

  it('rejects missing required arguments', () => {
    expect(() => validateToolArguments(schema, { count: 1 })).toThrow(/Missing required argument: projectId/);
  });

  it('accepts extra arguments not in schema', () => {
    const result = validateToolArguments(schema, { projectId: 'x', extra: 42 });
    expect(result.extra).toBe(42);
  });

  it('validates string types', () => {
    expect(() => validateToolArguments(schema, { projectId: 123 })).toThrow(/Invalid type for projectId: expected string, got number/);
  });

  it('validates integer types', () => {
    expect(() => validateToolArguments(schema, { projectId: 'x', count: 3.5 })).toThrow(/Invalid type for count: expected integer, got number/);
  });

  it('validates boolean types', () => {
    expect(() => validateToolArguments(schema, { projectId: 'x', active: 'yes' })).toThrow(/Invalid type for active: expected boolean, got string/);
  });

  it('validates array types', () => {
    expect(() => validateToolArguments(schema, { projectId: 'x', tags: 'not-array' })).toThrow(/Invalid type for tags: expected array, got string/);
  });

  it('validates nested object types', () => {
    expect(() => validateToolArguments(schema, { projectId: 'x', meta: 'bad' })).toThrow(/Invalid type for meta: expected object, got string/);
  });

  it('passes when arguments are not provided for optional fields', () => {
    const result = validateToolArguments(schema, { projectId: 'x' });
    expect(result.projectId).toBe('x');
    expect('count' in result).toBe(false);
  });
});
