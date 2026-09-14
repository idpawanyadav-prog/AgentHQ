import { withAuth } from '../../../lib/auth';
import { gatewayCredentials } from "../../../lib/gateway-credentials";
import type { NextApiRequest, NextApiResponse } from "next";

interface TestRequest {
 baseUrl?: string;
 apiKey?: string;
 model?: string;
 provider?: string;
}

interface TestResponse {
 success: boolean;
 message: string;
 status?: number;
 model?: string;
}

async function handler(
 req: NextApiRequest,
 res: NextApiResponse<TestResponse>
) {
 if (req.method !== "POST") {
 return res.status(405).json({ success: false, message: "Method not allowed" });
 }

 const { baseUrl, apiKey, model, provider }: TestRequest = await gatewayCredentials(req.body || {});

 if (!baseUrl || !apiKey || !model) {
 return res.status(400).json({ success: false, message: "Missing required fields: baseUrl, apiKey, model" });
 }

 const trimmedBase = baseUrl.replace(/\/+$/, "").replace(/\/v1$/, "");
 const isAnthropic = provider === "anthropic";
 const path = isAnthropic ? "/v1/messages" : "/v1/chat/completions";

 const headers: Record<string, string> = {
 "Content-Type": "application/json",
 };
 if (isAnthropic) {
 headers["x-api-key"] = apiKey;
 headers["anthropic-version"] = "2023-06-01";
 } else {
 headers["Authorization"] = `Bearer ${apiKey}`;
 }

 const body = isAnthropic
 ? JSON.stringify({
 model,
 max_tokens: 1,
 messages: [{ role: "user", content: "Hi" }],
 })
 : JSON.stringify({
 model,
 max_tokens: 1,
 messages: [{ role: "user", content: "Hi" }],
 });

 try {
 const response = await fetch(trimmedBase + path, {
 signal: AbortSignal.timeout(30000),
 method: "POST",
 headers,
 body,
 });

 if (response.ok) {
 return res.status(200).json({
 success: true,
 message: "Connection successful — API key and base URL are valid.",
 model,
 });
 }

 const text = await response.text();
 let msg = `HTTP ${response.status}`;
 try {
 const data = JSON.parse(text);
 msg = data.error?.message || data.message || msg;
 } catch {
 if (text && text.length < 200) msg = text;
 }

 return res.status(200).json({
 success: false,
 message: `Failed (${response.status}): ${msg}`,
 status: response.status,
 });
 } catch (err: any) {
 return res.status(200).json({
 success: false,
 message: `Network error: ${err.message || "Could not reach the gateway"}`,
 });
 }
}

export default withAuth(handler);
