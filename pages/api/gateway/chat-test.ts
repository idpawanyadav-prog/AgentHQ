import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../lib/auth';
import { gatewayCredentials } from '../../../lib/gateway-credentials';
import { parseSafeUrl } from '../../../lib/ssrf-guard';
import { safeFetch } from '../../../lib/safe-fetch';

type ChatMessage = {
	role: 'user' | 'assistant';
	content: string;
};

function textFromProviderResult(result: any, providerMode: 'anthropic' | 'openai') {
	const normalizeContent = (content: any): string => {
		if (typeof content === 'string') return content;
		if (Array.isArray(content)) {
			return content.map((item) => {
				if (typeof item === 'string') return item;
				if (typeof item?.text === 'string') return item.text;
				if (typeof item?.content === 'string') return item.content;
				if (typeof item?.output_text === 'string') return item.output_text;
				return '';
			}).filter(Boolean).join('\n');
		}
		if (typeof content?.text === 'string') return content.text;
		if (typeof content?.content === 'string') return content.content;
		return '';
	};

	if (providerMode === 'anthropic') return normalizeContent(result.content).trim();

	return (
		normalizeContent(result.choices?.[0]?.message?.content)
		|| normalizeContent(result.choices?.[0]?.text)
		|| normalizeContent(result.output_text)
		|| normalizeContent(result.output?.[0]?.content)
		|| normalizeContent(result.message?.content)
		|| normalizeContent(result.content)
		|| normalizeContent(result.response)
		|| normalizeContent(result.candidates?.[0]?.content?.parts)
	).trim();
}

function usageFromProviderResult(result: any) {
	const promptTokens = result.usage?.input_tokens ?? result.usage?.prompt_tokens ?? 0;
	const completionTokens = result.usage?.output_tokens ?? result.usage?.completion_tokens ?? 0;
	return { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
}

async function handler(req: NextApiRequest, res: NextApiResponse) {
	if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

	const message = typeof req.body?.message === 'string' ? req.body.message.trim() : '';
	const history = Array.isArray(req.body?.history) ? req.body.history as ChatMessage[] : [];
	if (!message) return res.status(400).json({ error: 'Message is required' });

	const { baseUrl, apiKey, model, provider } = await gatewayCredentials(req.body || {});
	if (!baseUrl || !apiKey || !model) {
		return res.status(400).json({ error: 'Missing required fields: baseUrl, apiKey, model' });
	}

	try {
		await parseSafeUrl(baseUrl);
	} catch (err) {
		return res.status(400).json({ error: `Refused: ${(err as Error).message}` });
	}

	const providerMode = provider === 'anthropic' ? 'anthropic' : 'openai';
	const base = baseUrl.replace(/\/+$/, '').replace(/\/v1$/, '');
	const messages = [
		...history
			.filter((item) => ['user', 'assistant'].includes(item.role) && typeof item.content === 'string')
			.slice(-8)
			.map((item) => ({ role: item.role, content: item.content })),
		{ role: 'user' as const, content: message },
	];

	try {
		const response = await safeFetch(base + (providerMode === 'anthropic' ? '/v1/messages' : '/v1/chat/completions'), {
			signal: AbortSignal.timeout(60000),
			method: 'POST',
			headers: providerMode === 'anthropic'
				? { 'Content-Type': 'application/json', 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' }
				: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
			body: JSON.stringify({
				model,
				max_tokens: 512,
				temperature: 0.2,
				...(providerMode === 'anthropic'
					? { system: 'You are testing this configured model. Reply briefly and directly.', messages }
					: { messages: [{ role: 'system', content: 'You are testing this configured model. Reply briefly and directly.' }, ...messages] }),
			}),
		});

		if (!response.ok) {
			const details = await response.text().catch(() => '');
			return res.status(200).json({
				success: false,
				message: `Chat failed (${response.status})${details ? `: ${details.slice(0, 240)}` : ''}`,
				status: response.status,
			});
		}

		const result = await response.json();
		const reply = textFromProviderResult(result, providerMode);
		if (!reply) {
			return res.status(200).json({ success: false, message: 'Gateway returned a response, but no message text was found.' });
		}

		return res.status(200).json({
			success: true,
			reply,
			model,
			provider,
			usage: usageFromProviderResult(result),
		});
	} catch (err) {
		return res.status(200).json({
			success: false,
			message: err instanceof Error ? err.message : 'Gateway chat failed',
		});
	}
}

export default withAuth(handler);
