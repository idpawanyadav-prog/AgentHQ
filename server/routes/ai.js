const express = require('express');
const router = express.Router();
const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const prisma = require('../prisma');
const { broadcastActivity, broadcastAgentStatus } = require('../socket');
const { createRateLimiter } = require('../middleware/rateLimit');
const { validate, aiProxySchema } = require('../middleware/validate');

const rateLimiter = createRateLimiter({ maxRequests: 60, windowMs: 60_000 });

function withAuth(req, res, next) {
 if (!req.user) return res.status(401).json({ error: 'Authentication required' });
 return next();
}
router.use('/proxy', withAuth, rateLimiter);

// ─── AI Proxy (Anthropic + OpenAI) ───────────────────────────────────────────
router.post('/proxy', validate(aiProxySchema), async (req, res) => {
 try {
 const { provider, model, messages, system, agentId, taskId, maxTokens, temperature } = req.body;

 const anthropicKey = process.env.ANTHROPIC_API_KEY;
 const openaiKey = process.env.OPENAI_API_KEY;

 let response;
 const startedAt = Date.now();

 if (provider === 'anthropic') {
 if (!anthropicKey) return res.status(500).json({ error: 'Anthropic API key not configured' });

 const anthropic = new Anthropic({ apiKey: anthropicKey });
 const completion = await anthropic.messages.create({
 model: model || 'claude-sonnet-4-5-20250929',
 max_tokens: maxTokens || 4096,
 system: system || undefined,
 temperature: temperature ?? undefined,
 messages,
 });

 response = {
 provider: 'anthropic',
 id: completion.id,
 model: completion.model,
 content: completion.content,
 stopReason: completion.stop_reason,
 usage: {
 promptTokens: completion.usage?.input_tokens ?? 0,
 completionTokens: completion.usage?.output_tokens ?? 0,
 totalTokens: (completion.usage?.input_tokens ?? 0) + (completion.usage?.output_tokens ?? 0),
 },
 };

 } else if (provider === 'openai') {
 if (!openaiKey) return res.status(500).json({ error: 'OpenAI API key not configured' });

 const openai = new OpenAI({ apiKey: openaiKey });
 const chatCompletion = await openai.chat.completions.create({
 model: model || 'gpt-4o',
 max_tokens: maxTokens || 4096,
 messages: system
 ? [{ role: 'system', content: system }, ...messages]
 : messages,
 temperature: temperature ?? undefined,
 });

 response = {
 provider: 'openai',
 id: chatCompletion.id,
 model: chatCompletion.model,
 content: chatCompletion.choices.map((c) => c.message),
 stopReason: chatCompletion.choices[0]?.finish_reason,
 usage: {
 promptTokens: chatCompletion.usage?.prompt_tokens ?? 0,
 completionTokens: chatCompletion.usage?.completion_tokens ?? 0,
 totalTokens: chatCompletion.usage?.total_tokens ?? 0,
 },
 };

 } else {
 return res.status(400).json({ error: `Unknown provider: "${provider}". Use "anthropic" or "openai".` });
 }

 const latencyMs = Date.now() - startedAt;

 // Log the AI call to the activity feed
 if (agentId || taskId) {
 let teamId;
 if (agentId) {
 const agent = await prisma.agent.findUnique({
 where: { id: agentId },
 include: { member: { select: { teamId: true } } },
 });
 teamId = agent?.member?.teamId;
 }

 if (teamId) {
 const activity = await prisma.activity.create({
 data: {
 type: 'ai_completed',
 description: `${provider} ${model} call completed in ${latencyMs}ms`,
 meta: JSON.stringify({
 provider,
 model,
 latencyMs,
 usage: response.usage,
 agentId: agentId || null,
 taskId: taskId || null,
 }),
 teamId,
 memberId: agentId ? null : req.user?.id,
 taskId: taskId || null,
 },
 });
 broadcastActivity(activity);
 }

 // Update agent status if applicable
 if (agentId) {
 const agent = await prisma.agent.update({
 where: { id: agentId },
 data: { status: 'idle' },
 include: { member: { select: { teamId: true } } },
 });
 broadcastAgentStatus(agent);
 }
 }

 res.json(response);
 } catch (err) {
 console.error('[AI Proxy]', err);

 // Update agent status to error if applicable
 if (req.body.agentId) {
 try {
 const agent = await prisma.agent.update({
 where: { id: req.body.agentId },
 data: { status: 'error' },
 include: { member: { select: { teamId: true } } },
 });
 broadcastAgentStatus(agent);
 } catch (_e) {
 void _e;
 }
 }

 res.status(500).json({
 error: 'AI provider error',
 message: err.message,
 provider: err.code,
 });
 }
});

// ─── Available models ─────────────────────────────────────────────────────────
router.get('/models', (_req, res) => {
 res.json({
 anthropic: [
 { id: 'claude-sonnet-4-5-20250929', name: 'Claude Sonnet 4.5', provider: 'anthropic' },
 { id: 'claude-3-5-sonnet-20240620', name: 'Claude 3.5 Sonnet', provider: 'anthropic' },
 { id: 'claude-3-5-haiku-20241022', name: 'Claude 3.5 Haiku', provider: 'anthropic' },
 { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus', provider: 'anthropic' },
 ],
 openai: [
 { id: 'gpt-4o', name: 'GPT-4o', provider: 'openai' },
 { id: 'gpt-4o-mini', name: 'GPT-4o Mini', provider: 'openai' },
 { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
 { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
 ],
 });
});

module.exports = router;
