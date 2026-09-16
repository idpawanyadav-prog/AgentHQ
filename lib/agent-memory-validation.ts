const SKILL_LEVELS = new Set(['beginner', 'intermediate', 'advanced', 'expert']);
const COLOR_PATTERN = /^(#[0-9a-fA-F]{3}(?:[0-9a-fA-F]{3})?|rgb\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*\)|rgba\(\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*\d{1,3}\s*,\s*(0|1|0?\.\d+)\s*\)|var\(--[a-zA-Z0-9-_]+\))$/;

type ValidationResult<T> = { ok: true; value: T } | { ok: false; error: string };

function text(value: unknown): string | undefined {
	return typeof value === 'string' ? value.trim() : undefined;
}

function optionalText(value: unknown, max: number, field: string): ValidationResult<string | null | undefined> {
	if (value === undefined) return { ok: true, value: undefined };
	if (value === null) return { ok: true, value: null };
	const trimmed = text(value);
	if (trimmed === undefined) return { ok: false, error: `${field} must be a string` };
	if (trimmed.length > max) return { ok: false, error: `${field} must be ${max} characters or fewer` };
	return { ok: true, value: trimmed || null };
}

function requiredText(value: unknown, max: number, field: string): ValidationResult<string> {
	const trimmed = text(value);
	if (!trimmed) return { ok: false, error: `${field} is required` };
	if (trimmed.length > max) return { ok: false, error: `${field} must be ${max} characters or fewer` };
	return { ok: true, value: trimmed };
}

export function validateRoleGroupPayload(body: Record<string, unknown>, partial = false) {
	const result: { name?: string; description?: string | null; color?: string | null } = {};
	if (!partial || body.name !== undefined) {
		const name = requiredText(body.name, 100, 'name');
		if (!name.ok) return name;
		result.name = name.value;
	}
	if (!partial || body.description !== undefined) {
		const description = optionalText(body.description, 2000, 'description');
		if (!description.ok) return description;
		result.description = description.value ?? null;
	}
	if (!partial || body.color !== undefined) {
		const color = optionalText(body.color, 100, 'color');
		if (!color.ok) return color;
		if (color.value && !COLOR_PATTERN.test(color.value)) return { ok: false as const, error: 'color is not a supported format' };
		result.color = color.value ?? null;
	}
	return { ok: true as const, value: result };
}

export function validateInstructionPayload(body: Record<string, unknown>, partial = false) {
	const result: { filename?: string; title?: string | null; content?: string } = {};
	if (!partial || body.filename !== undefined) {
		const filename = requiredText(body.filename, 255, 'filename');
		if (!filename.ok) return filename;
		result.filename = filename.value;
	}
	if (!partial || body.title !== undefined) {
		const title = optionalText(body.title, 255, 'title');
		if (!title.ok) return title;
		result.title = title.value ?? null;
	}
	if (!partial || body.content !== undefined) {
		const content = requiredText(body.content, 10000, 'content');
		if (!content.ok) return content;
		result.content = content.value;
	}
	return { ok: true as const, value: result };
}

export function validateSkillPayload(body: Record<string, unknown>, partial = false) {
	const result: { name?: string; level?: string; description?: string | null } = {};
	if (!partial || body.name !== undefined) {
		const name = requiredText(body.name, 100, 'name');
		if (!name.ok) return name;
		result.name = name.value;
	}
	if (!partial || body.level !== undefined) {
		const level = text(body.level) || 'intermediate';
		if (!SKILL_LEVELS.has(level)) return { ok: false as const, error: 'level must be beginner, intermediate, advanced, or expert' };
		result.level = level;
	}
	if (!partial || body.description !== undefined) {
		const description = optionalText(body.description, 1000, 'description');
		if (!description.ok) return description;
		result.description = description.value ?? null;
	}
	return { ok: true as const, value: result };
}

export function validateAgentId(body: Record<string, unknown>) {
	return requiredText(body.agentId, 255, 'agentId');
}
