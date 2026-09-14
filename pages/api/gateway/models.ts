import { withAuth } from '../../../lib/auth';
import { gatewayCredentials } from "../../../lib/gateway-credentials";
import type { NextApiRequest, NextApiResponse } from "next";

interface ModelsRequest {
 baseUrl?: string;
 apiKey?: string;
 provider?: string;
}

interface ModelsResponse {
 success: boolean;
 models?: Array<{ id: string; name?: string }>;
 message?: string;
}

async function handler(
 req: NextApiRequest,
 res: NextApiResponse<ModelsResponse>
) {
 if (req.method !== "POST") {
 return res.status(405).json({ success: false, message: "Method not allowed" });
 }

 const { baseUrl, apiKey, provider }: ModelsRequest = await gatewayCredentials(req.body || {});

 if (!baseUrl || !apiKey) {
 return res.status(400).json({ success: false, message: "Missing baseUrl or apiKey" });
 }

 const trimmedBase = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
 const isOpenAI = provider !== "anthropic";

 try {
 if (isOpenAI) {
 // OpenAI-compatible: GET /v1/models
 const response = await fetch(`${trimmedBase}/v1/models`, {
 signal: AbortSignal.timeout(30000),
 method: "GET",
 headers: {
 Authorization: `Bearer ${apiKey}`,
 },
 });

 if (response.ok) {
 const data = await response.json();
 const models = (data.data || [])
 .map((m: any) => ({ id: m.id, name: m.id }))
 .sort((a: any, b: any) => a.id.localeCompare(b.id));
 return res.status(200).json({ success: true, models });
 }

 // If /v1/models fails, fall back to extracting from an error response
 if (provider === "anthropic") {
 return extractAnthropicModels(trimmedBase, apiKey, res);
 }

 const text = await response.text();
 let msg = `HTTP ${response.status}`;
 try {
 const err = JSON.parse(text);
 msg = err.error?.message || err.message || msg;
 } catch {
 if (text.length < 200) msg = text;
 }
 return res.status(200).json({ success: false, message: `Failed (${response.status}): ${msg}` });
 } else {
 return extractAnthropicModels(trimmedBase, apiKey, res);
 }
 } catch (err: any) {
 return res.status(200).json({
 success: false,
 message: `Network error: ${err.message || "Could not reach the gateway"}`,
 });
 }
}

async function extractAnthropicModels(
 baseUrl: string,
 apiKey: string,
 res: NextApiResponse<ModelsResponse>
) {
 // Anthropic doesn't have a /models endpoint.
 // Send a request with an intentionally invalid model name; the error
 // response body contains the list of valid models.
 try {
 const response = await fetch(`${baseUrl}/v1/messages`, {
 signal: AbortSignal.timeout(30000),
 method: "POST",
 headers: {
 "Content-Type": "application/json",
 "x-api-key": apiKey,
 "anthropic-version": "2023-06-01",
 },
 body: JSON.stringify({
 model: "nonexistent-model-zzz",
 max_tokens: 1,
 messages: [{ role: "user", content: "Hi" }],
 }),
 });

 const text = await response.text();

 if (response.status === 404 || response.status === 405) {
 return res.status(200).json({
 success: false,
 message: "This endpoint does not look like an Anthropic-compatible API. Try selecting 'Custom / OpenAI-Compatible' as the provider.",
 });
 }

 let errMsg = "";
 try {
 const data = JSON.parse(text);
 errMsg = data.error?.message || "";
 } catch {
 errMsg = text;
 }

 // Anthropic error messages contain a list like: "Invalid model: x. Available models: claude-3-5-sonnet, claude-3-opus..."
 const match = errMsg.match(/available models[:\s]+(.+)/i);
 if (match) {
 const modelIds = match[1]
 .split(",")
 .map((m: string) => m.trim())
 .filter((m: string) => m.length > 0)
 .map((id: string) => ({ id, name: id }));
 return res.status(200).json({ success: true, models: modelIds });
 }

 return res.status(200).json({
 success: false,
 message: `Could not extract model list. Server responded: ${errMsg.slice(0, 200)}`,
 });
 } catch (err: any) {
 return res.status(200).json({
 success: false,
 message: `Network error: ${err.message || "Could not reach the gateway"}`,
 });
 }
}

export default withAuth(handler);
