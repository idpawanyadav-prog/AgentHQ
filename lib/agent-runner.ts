import prisma from './prisma';
import { decrypt } from './secrets';
import { parseSafeUrl } from './ssrf-guard';
import { safeFetch } from './safe-fetch';
import { enqueueJob, heartbeatJob, getJob, cancelJob, listJobs, type JobRecord } from './job-queue';
import { logActivity } from './activity-service';

const DEFAULT_TIMEOUT_MS = 120_000;
const MAX_PARALLEL_AGENTS = Number(process.env.MAX_PARALLEL_AGENTS || 5);
export async function startAgent(id: string, taskId: string) {
 const agent = await prisma.agent.findUnique({ where: { id }, include: { member: true } });
 const task = await prisma.task.findUnique({ where: { id: taskId } });
 if (!agent || !task) throw new Error('Agent or task not found');
 if (task.teamId !== agent.member.teamId) throw new Error('Agent and task must belong to the same team');
 if (task.status === 'done' || task.blocked) throw new Error('Choose an unfinished, unblocked task');
 if (agent.status === 'working') throw new Error('Agent is already working');

 const runningCount = await prisma.agent.count({ where: { status: 'working' } });
 if (runningCount >= MAX_PARALLEL_AGENTS) throw new Error('Maximum number of agents are already running');

 const gateway = await prisma.gateway.findFirst({
 where: { OR: [{ provider: agent.type }, { provider: 'custom' }] },
 orderBy: { isDefault: 'desc' },
 });
 const provider = (gateway?.provider || agent.type) as 'anthropic' | 'openai' | 'custom';
 const messages = [{
 role: 'user' as const,
 content: `${task.title}\n\n${task.description || ''}\n\nAcceptance criteria: ${task.acceptanceCriteria || '[]'}`,
 }];

 const key=gateway ? decrypt(gateway.apiKey) : provider==='anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
 if(!key) throw new Error('Configure a provider gateway before starting this agent');
 if(gateway?.baseUrl) await parseSafeUrl(gateway.baseUrl);
 const config=typeof agent.config==='string'?JSON.parse(agent.config):agent.config || {};
 const payload={agentId:id,taskId,teamId:task.teamId,config,model:agent.model,provider,gatewayId:gateway?.id,messages};
 const job=await prisma.$transaction(async tx=>{
  if(await tx.agent.count({where:{status:'working'}})>=MAX_PARALLEL_AGENTS) throw new Error('Agent concurrency limit reached');
  const claimed=await tx.agent.updateMany({where:{id,status:{not:'working'}},data:{status:'working'}});
  if(claimed.count!==1) throw new Error('Agent is already working');
  await tx.task.update({where:{id:taskId},data:{agentId:id,status:'in_progress'}});
  const created=await tx.job.create({data:{kind:'agent_run',agentId:id,taskId,teamId:task.teamId,payload:JSON.stringify(payload),maxAttempts:3}});
  await tx.activity.create({data:{teamId:task.teamId,memberId:agent.memberId,taskId,type:'agent_started',description:`${agent.name} queued ${task.title}`,meta:JSON.stringify({agentId:id,jobId:created.id})}});
  return created;
 });

 return { id, status: 'working', jobId: job.id };
}

export async function stopAgent(agentId: string) {
 const openJobs = await listJobs({ agentId, status: ['queued','running'] });
 for (const j of openJobs) await cancelJob(j.id);

 const agent = await prisma.agent.findUnique({ where: { id: agentId }, include: { member: true } });
 if (!agent) throw new Error('Agent not found');

 await prisma.agent.update({ where: { id: agentId }, data: { status: 'idle' } });
 await logActivity({
 teamId: agent.member.teamId,
 memberId: agent.memberId,
 type: 'agent_stopped',
 description: `${agent.name} stopped`,
 meta: { agentId, jobIds: openJobs.map((j) => j.id) },
 });
 return { id: agentId, status: 'idle', cancelled: openJobs.length };
}

export async function jobStatus(jobId: string) {
 const job = await getJob(jobId);
 if (!job) return null;
 const agent = await prisma.agent.findUnique({ where: { id: job.agentId }, select: { status: true } });
 return { ...job, agentStatus: agent?.status || 'idle' };
}

export async function listAgentJobs(agentId: string) {
 const jobs = await listJobs({ agentId, status: ['queued','running'] });
 return jobs.slice(0, 20);
}

// ─── Worker handler ───────────────────────────────────────────────────────────

/**
 * Called by the worker for each running job. Executes the agent against the
 * configured gateway, with heartbeat, cancellation checks, and budget guards.
 */
export async function runAgentJob(job: JobRecord, signal: AbortSignal): Promise<{ output: string; usage: { promptTokens: number; completionTokens: number; totalTokens: number }; latencyMs: number }> {
 const agent = await prisma.agent.findUnique({ where: { id: job.agentId }, include: { member: true } });
 if (!agent) throw new Error('Agent not found');

 const gateway = job.payload.gatewayId
 ? await prisma.gateway.findUnique({ where: { id: job.payload.gatewayId } })
 : null;

 const key = gateway
 ? decrypt(gateway.apiKey)
 : job.payload.provider === 'anthropic'
 ? process.env.ANTHROPIC_API_KEY
 : process.env.OPENAI_API_KEY;
 if (!key) throw new Error('Configure a provider gateway in Settings before starting this agent');

 const defaultBase = job.payload.provider === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com';
 let rawBase = gateway?.baseUrl || defaultBase;
 if (gateway?.baseUrl) {
 try {
 const safe = await parseSafeUrl(gateway.baseUrl);
 rawBase = safe.url.toString();
 } catch (err) {
 throw new Error(`Gateway URL is not allowed: ${(err as Error).message}`);
 }
 }
 const base = rawBase.replace(/\/+$/, '').replace(/\/v1$/, '');
 const isAnthropic = job.payload.provider === 'anthropic';

 // Daily budget guardrail
 await enforceBudgetGuard(job);

 const timeoutMs = parseInt(process.env.AGENT_TIMEOUT_MS || String(DEFAULT_TIMEOUT_MS), 10);
 const startedAt = Date.now();

 const controller = new AbortController();
 const timeoutHandle = setTimeout(() => controller.abort(), timeoutMs);
 const abort=()=>controller.abort();
 signal.addEventListener("abort",abort,{once:true});
 if(signal.aborted) controller.abort();

 try {
 const fetchStart = Date.now();
 const response = await safeFetch(base + (isAnthropic ? '/v1/messages' : '/v1/chat/completions'), {
 method: 'POST',
 signal: controller.signal,
 headers: isAnthropic
 ? { 'Content-Type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' }
 : { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
 body: JSON.stringify({
 model: job.payload.model,
 max_tokens: job.payload.config.maxTokens || 4096,
 ...(isAnthropic
 ? { system: job.payload.config.systemPrompt || 'Help complete the task. Return your work and explain any remaining steps.', messages: job.payload.messages }
 : {
 messages: [
 { role: 'system', content: job.payload.config.systemPrompt || 'Help complete the task. Return your work and explain any remaining steps.' },
 ...job.payload.messages,
 ],
 }),
 }),
 });

 if (!response.ok) {const error=new Error(`Provider returned HTTP ${response.status}`) as Error & {retryable:boolean};error.retryable=response.status===429 || response.status>=500;throw error;}
 const result = await response.json();
 if (signal.aborted || controller.signal.aborted) {
 throw new Error('Cancelled by user');
 }

 const promptTokens = result.usage?.input_tokens ?? result.usage?.prompt_tokens ?? 0;
 const completionTokens = result.usage?.output_tokens ?? result.usage?.completion_tokens ?? 0;
 const text = isAnthropic
 ? (result.content || []).map((c: { text?: string }) => c.text || '').join('\n')
 : result.choices?.[0]?.message?.content || '';

 const usage = { promptTokens, completionTokens, totalTokens: promptTokens + completionTokens };
 const latencyMs = Date.now() - fetchStart;


 return { output: text, usage, latencyMs };
 } finally {
 signal.removeEventListener("abort",abort);
 clearTimeout(timeoutHandle);
 }
}

async function enforceBudgetGuard(job: JobRecord) {
 const maxTokens=Number(job.payload.config.maxTokens || 4096);
 if(!Number.isInteger(maxTokens) || maxTokens<1 || maxTokens>32768) throw new Error('maxTokens must be between 1 and 32768');
 const startOfDay=new Date();startOfDay.setUTCHours(0,0,0,0);
 const events=await prisma.activity.findMany({where:{teamId:job.teamId,type:'agent_completed',createdAt:{gte:startOfDay}}});
 let tokens=0;
 for(const event of events) {try {tokens+=Number(JSON.parse(event.meta).usage?.totalTokens || 0);}catch{}}
 if(tokens+maxTokens>Number(process.env.MAX_DAILY_TOKENS || 1000000)) throw new Error('Daily token limit reached');
}
