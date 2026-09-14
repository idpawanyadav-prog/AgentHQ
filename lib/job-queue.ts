import prisma from './prisma';

// ─── Types ─────────────────────────────────────────────────────────────────────

export type JobKind = 'agent_run';
export type JobStatus = 'queued' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface JobPayload {
 agentId: string;
 taskId: string;
 teamId: string;
 config: Record<string, unknown>;
 model: string;
 provider: 'anthropic' | 'openai' | 'custom';
 gatewayId?: string;
 messages: Array<{ role: string; content: string }>;
}

export interface JobResult {
 output: string;
 usage: { promptTokens: number; completionTokens: number; totalTokens: number };
 latencyMs: number;
}

export interface JobRecord {
 id: string;
 kind: JobKind;
 status: JobStatus;
 agentId: string;
 taskId: string | null;
 teamId: string;
 payload: JobPayload;
 result: JobResult | null;
 error: string | null;
 attempts: number;
 maxAttempts: number;
 startedAt: Date | null;
 finishedAt: Date | null;
 heartbeatAt: Date | null;
 cancelled: boolean;
 createdAt: Date;
 updatedAt: Date;
}

const HEARTBEAT_TIMEOUT_MS = 30_000;
function toRecord(row: any): JobRecord {
 return {...row,payload:JSON.parse(row.payload),result:row.result ? JSON.parse(row.result) : null};
}
export async function enqueueJob(payload: JobPayload, maxAttempts=3): Promise<JobRecord> {
 return toRecord(await prisma.job.create({data:{kind:'agent_run',payload:JSON.stringify(payload),agentId:payload.agentId,taskId:payload.taskId,teamId:payload.teamId,maxAttempts}}));
}
export async function getJob(id:string) {const row=await prisma.job.findUnique({where:{id}});return row ? toRecord(row) : null;}
export async function listJobs(filters?: {agentId?:string;taskId?:string;status?:JobStatus|JobStatus[]}) {
 const rows=await prisma.job.findMany({where:{agentId:filters?.agentId,taskId:filters?.taskId,status:Array.isArray(filters?.status)?{in:filters.status}:filters?.status},orderBy:{createdAt:'desc'},take:100});
 return rows.map(toRecord);
}
export async function cancelJob(id:string) {
 return prisma.$transaction(async tx=>{
  const job=await tx.job.findUnique({where:{id}});
  if(!job || !['queued','running'].includes(job.status)) return false;
  const changed=await tx.job.updateMany({where:{id,status:{in:['queued','running']}},data:{status:'cancelled',cancelled:true,finishedAt:new Date()}});
  if(!changed.count) return false;
  await tx.agent.updateMany({where:{id:job.agentId},data:{status:'idle'}});
  return true;
 });
}
export async function heartbeatJob(id:string, attempt?:number) {
 await prisma.job.updateMany({where:{id,status:'running',cancelled:false,...(attempt ? {attempts:attempt}:{})},data:{heartbeatAt:new Date()}});
}
export async function recoverStaleJobs():Promise<JobRecord[]> {
 const threshold=new Date(Date.now()-HEARTBEAT_TIMEOUT_MS);
 const stale=await prisma.job.findMany({where:{status:'running',OR:[{heartbeatAt:{lt:threshold}},{heartbeatAt:null}]}});
 const recovered:JobRecord[]=[];
 for(const job of stale) {
  await prisma.$transaction(async tx=>{
   const terminal=job.attempts>=job.maxAttempts;
   const changed=await tx.job.updateMany({where:{id:job.id,status:'running',attempts:job.attempts,heartbeatAt:job.heartbeatAt},data:{status:terminal?'failed':'queued',startedAt:null,heartbeatAt:null,finishedAt:terminal?new Date():null,error:'Worker lease expired'}});
   if(changed.count && terminal) await tx.agent.updateMany({where:{id:job.agentId},data:{status:'error'}});
   if(changed.count) recovered.push(toRecord({...job,status:terminal?'failed':'queued'}));
  });
 }
 return recovered;
}
/** Attempts act as fencing tokens; a cancelled or recovered lease cannot commit. */
export async function completeJob(job:JobRecord,result:JobResult) {
 return prisma.$transaction(async tx=>{
  const changed=await tx.job.updateMany({where:{id:job.id,status:'running',cancelled:false,attempts:job.attempts},data:{status:'completed',finishedAt:new Date(),result:JSON.stringify(result),error:null}});
  if(!changed.count) return false;
  const agent=await tx.agent.findUnique({where:{id:job.agentId}});
  if(!agent) throw new Error('Agent no longer exists');
  await tx.agent.update({where:{id:job.agentId},data:{status:'idle'}});
  if(job.taskId) await tx.task.updateMany({where:{id:job.taskId,agentId:job.agentId,status:'in_progress'},data:{status:'review'}});
  await tx.activity.create({data:{teamId:job.teamId,memberId:agent.memberId,taskId:job.taskId,type:'agent_completed',description:`${agent.name} returned output for review`,meta:JSON.stringify({agentId:job.agentId,jobId:job.id,model:job.payload.model,provider:job.payload.provider,...result})}});
  return true;
 });
}
export function startWorker(onRun:(job:JobRecord,signal:AbortSignal)=>Promise<JobResult>) {
 let running=true;
 let current:AbortController|undefined;
 let wake:(()=>void)|undefined;
 const pause=(ms:number)=>new Promise<void>(resolve=>{const timer=setTimeout(resolve,ms);wake=()=>{clearTimeout(timer);resolve();};});
 const loop=(async()=>{
  while(running) {
   try {
    await recoverStaleJobs();
    // Exhausted queued records must not block the queue head indefinitely.
    const queued=await prisma.job.findMany({where:{status:'queued',cancelled:false},orderBy:{createdAt:'asc'},take:100});
    for(const exhausted of queued.filter(j=>j.attempts>=j.maxAttempts)) {
     await prisma.$transaction(async tx=>{
      const changed=await tx.job.updateMany({where:{id:exhausted.id,status:'queued'},data:{status:'failed',finishedAt:new Date(),error:'Retry limit reached'}});
      if(changed.count) await tx.agent.updateMany({where:{id:exhausted.agentId},data:{status:'error'}});
     });
    }
    const row=queued.find(j=>j.attempts<j.maxAttempts);
    if(!row) {await pause(500);continue;}
    const changed=await prisma.job.updateMany({where:{id:row.id,status:'queued',cancelled:false,attempts:row.attempts},data:{status:'running',startedAt:new Date(),heartbeatAt:new Date(),attempts:{increment:1}}});
    if(!changed.count) continue;
    const job=toRecord({...row,status:'running',attempts:row.attempts+1});
    const controller=new AbortController();current=controller;
    let checking=false;
    const heartbeat=setInterval(async()=>{
     if(checking)return;checking=true;
     try {
      const latest=await prisma.job.findUnique({where:{id:job.id}});
      if(!latest || latest.cancelled || latest.status!=='running' || latest.attempts!==job.attempts) controller.abort();
      else await heartbeatJob(job.id,job.attempts);
     } catch {controller.abort();} finally {checking=false;}
    },500);
    try {
     const result=await onRun(job,controller.signal);
     if(!controller.signal.aborted) await completeJob(job,result);
    } catch(error) {
     const retryable=(error as {retryable?:boolean}).retryable===true || !running;
     const retry=retryable && job.attempts<job.maxAttempts;
     await prisma.$transaction(async tx=>{
      const changed=await tx.job.updateMany({where:{id:job.id,status:'running',cancelled:false,attempts:job.attempts},data:{status:retry?'queued':'failed',finishedAt:retry?null:new Date(),heartbeatAt:null,error:(error as Error).message}});
      if(changed.count && !retry) {
       await tx.agent.updateMany({where:{id:job.agentId},data:{status:'error'}});
       await tx.activity.create({data:{teamId:job.teamId,taskId:job.taskId,type:'agent_error',description:'Agent request failed',meta:JSON.stringify({agentId:job.agentId,jobId:job.id,error:(error as Error).message})}});
      }
     });
     if(retry) await pause(Math.min(1000*2**job.attempts,10000));
    } finally {clearInterval(heartbeat);current=undefined;}
   } catch(error) {console.error(JSON.stringify({event:'worker_error',error:(error as Error).message}));await pause(1000);}
  }
 })();
 return async()=>{running=false;current?.abort();wake?.();await loop;};
}
