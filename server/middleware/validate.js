const { z } = require('zod');

// ─── Shared schemas ────────────────────────────────────────────────────────────

const createTeamSchema = z.object({
 name: z.string().min(1, 'Name is required').max(120),
 description: z.string().max(500).optional().nullable(),
 status: z.enum(['active', 'paused', 'archived']).optional(),
});

const updateTeamSchema = z.object({
 name: z.string().min(1).max(120).optional(),
 description: z.string().max(500).optional().nullable(),
 status: z.enum(['active', 'paused', 'archived']).optional(),
});

const createTaskSchema = z.object({
 title: z.string().min(1, 'Title is required').max(200),
 description: z.string().max(2000).optional().nullable(),
 type: z.enum(['task', 'bug', 'feature', 'chore']).optional(),
 priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
 status: z.enum(['backlog', 'ready', 'in_progress', 'review', 'testing', 'done', 'blocked']).optional(),
 teamId: z.string().min(1, 'teamId is required'),
 projectId: z.string().optional().nullable(),
 sprintId: z.string().optional().nullable(),
 assigneeId: z.string().optional().nullable(),
 agentId: z.string().optional().nullable(),
 branch: z.string().max(120).optional().nullable(),
 dependencies: z.array(z.string()).optional(),
 storyPoints: z.coerce.number().int().positive().optional(),
 dueDate: z.string().datetime().optional().nullable(),
 acceptanceCriteria: z.array(z.object({ text: z.string(), done: z.boolean() })).optional(),
 blocked: z.boolean().optional(),
 blockedReason: z.string().max(500).optional().nullable(),
});

const updateTaskSchema = createTaskSchema.partial();

const createAgentSchema = z.object({
 name: z.string().min(1).max(120),
 type: z.enum(['anthropic', 'openai']),
 model: z.string().min(1).max(80),
 memberId: z.string().min(1),
 config: z.object({
 temperature: z.number().min(0).max(2).optional(),
 maxTokens: z.number().int().positive().optional(),
 systemPrompt: z.string().max(4000).optional(),
 }).optional(),
 status: z.enum(['idle', 'working', 'error']).optional(),
});

const updateAgentSchema = z.object({
 name: z.string().min(1).max(120).optional(),
 model: z.string().min(1).max(80).optional(),
 config: z.object({
 temperature: z.number().min(0).max(2).optional(),
 maxTokens: z.number().int().positive().optional(),
 systemPrompt: z.string().max(4000).optional(),
 }).optional(),
 status: z.enum(['idle', 'working', 'error']).optional(),
});

const createProjectSchema = z.object({
 name: z.string().min(1).max(120),
 description: z.string().max(2000).optional().nullable(),
 status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
 teamId: z.string().min(1),
 repoUrl: z.string().url().optional().nullable(),
});

const createSprintSchema = z.object({
 name: z.string().min(1).max(120),
 goal: z.string().max(500).optional().nullable(),
 status: z.enum(['planned', 'active', 'completed']).optional(),
 projectId: z.string().min(1),
 order: z.coerce.number().int().nonnegative().optional(),
});

const updateProjectSchema = z.object({
 name: z.string().min(1).max(120).optional(),
 description: z.string().max(500).optional().nullable(),
 status: z.enum(['active', 'paused', 'completed', 'archived']).optional(),
 progress: z.coerce.number().int().min(0).max(100).optional(),
 repoUrl: z.string().url().optional().nullable(),
});

const updateMilestoneSchema = z.object({
 status: z.enum(['planned', 'active', 'completed', 'cancelled']).optional(),
});

const createMilestoneSchema = z.object({
 title: z.string().min(1).max(200),
 order: z.coerce.number().int().nonnegative().optional(),
});

const assignTaskSchema = z.object({
 memberId: z.string().optional().nullable(),
 agentId: z.string().optional().nullable(),
});

const agentStatusSchema = z.object({
 status: z.enum(['idle', 'working', 'error']),
});

const startAgentSchema = z.object({
 taskId: z.string().min(1),
});

const jobCancelSchema = z.object({});

const aiProxySchema = z.object({
 provider: z.enum(['anthropic', 'openai']),
 model: z.string().min(1).max(80).optional(),
 messages: z.array(z.object({ role: z.string(), content: z.string() })).min(1),
 system: z.string().max(4000).optional(),
 agentId: z.string().optional(),
 taskId: z.string().optional(),
 maxTokens: z.coerce.number().int().positive().optional(),
 temperature: z.coerce.number().min(0).max(2).optional(),
});

// ─── Middleware factory ────────────────────────────────────────────────────────

function validate(schema) {
 return (req, res, next) => {
 try {
 req.body = schema.parse(req.body);
 next();
 } catch (err) {
 if (err && err.errors) {
 const message = err.errors.map(e => `${e.path.join('.') || 'body'}: ${e.message}`).join('; ');
 return res.status(400).json({ error: message });
 }
 return res.status(400).json({ error: 'Invalid request body' });
 }
 };
}

module.exports = {
 validate,
 createTeamSchema,
 updateTeamSchema,
 createTaskSchema,
 updateTaskSchema,
 createAgentSchema,
 updateAgentSchema,
 createProjectSchema,
 updateProjectSchema,
 updateMilestoneSchema,
 createSprintSchema,
 assignTaskSchema,
 agentStatusSchema,
 startAgentSchema,
 jobCancelSchema,
 aiProxySchema,
};
