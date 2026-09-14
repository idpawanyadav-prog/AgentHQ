import prisma from './prisma';
import { decrypt } from './secrets';

const globalRuns = globalThis as typeof globalThis & { agentRuns?: Map<string, AbortController> };
const runs = globalRuns.agentRuns ??= new Map();

export async function startAgent(id: string, taskId: string) {
  const agent = await prisma.agent.findUnique({where:{id},include:{member:true}});
  const task = await prisma.task.findUnique({where:{id:taskId}});
  if(!agent || !task) throw new Error('Agent or task not found');
  if(task.teamId !== agent.member.teamId) throw new Error('Agent and task must belong to the same team');
  if(task.status === 'done' || task.blocked) throw new Error('Choose an unfinished, unblocked task');
  if(agent.status === 'working' || runs.has(id)) throw new Error('Agent is already working');
  const gateway = await prisma.gateway.findFirst({where:{OR:[{provider:agent.type},{provider:'custom'}]},orderBy:{isDefault:'desc'}});
  const key = gateway ? decrypt(gateway.apiKey) : agent.type === 'anthropic' ? process.env.ANTHROPIC_API_KEY : process.env.OPENAI_API_KEY;
  if(!key) throw new Error('Configure a provider gateway in Settings before starting this agent');
  const base = (gateway?.baseUrl || (agent.type === 'anthropic' ? 'https://api.anthropic.com' : 'https://api.openai.com')).replace(/\/+$/,'').replace(/\/v1$/,'');
  const anthropic = gateway ? gateway.provider === 'anthropic' : agent.type === 'anthropic';
  const config = JSON.parse(agent.config || '{}');
  const controller = new AbortController();
  runs.set(id,controller);
  try {
    await prisma.$transaction(async tx => {
      const claimed = await tx.agent.updateMany({where:{id,status:{not:'working'}},data:{status:'working'}});
      if(claimed.count !== 1) throw new Error('Agent is already working');
      await tx.task.update({where:{id:taskId},data:{agentId:id,status:'in_progress'}});
      await tx.activity.create({data:{teamId:task.teamId,memberId:agent.memberId,taskId,type:'agent_started',description:`${agent.name} started ${task.title}`,meta:JSON.stringify({agentId:id})}});
    });
  } catch(e) { runs.delete(id);throw e; }
  const timeout = setTimeout(()=>controller.abort(),120000);
  void (async () => {
    try {
      const messages = [{role:'user',content:`${task.title}\n\n${task.description || ''}\n\nAcceptance criteria: ${task.acceptanceCriteria || '[]'}`}];
      const response = await fetch(base + (anthropic ? '/v1/messages' : '/v1/chat/completions'),{
        method:'POST',signal:controller.signal,
        headers:anthropic ? {'Content-Type':'application/json','x-api-key':key,'anthropic-version':'2023-06-01'} : {'Content-Type':'application/json',Authorization:`Bearer ${key}`},
        body:JSON.stringify({model:agent.model,max_tokens:config.maxTokens || 4096,
          ...(anthropic ? {system:config.systemPrompt || 'Help complete the task. Return your work and explain any remaining steps.',messages} : {messages:[{role:'system',content:config.systemPrompt || 'Help complete the task. Return your work and explain any remaining steps.'},...messages]})}),
      });
      if(!response.ok) throw new Error(`Provider returned HTTP ${response.status}`);
      const result = await response.json();
      if(controller.signal.aborted) return;
      const input = result.usage?.input_tokens ?? result.usage?.prompt_tokens ?? 0;
      const output = result.usage?.output_tokens ?? result.usage?.completion_tokens ?? 0;
      const text = anthropic ? (result.content || []).map((c:{text?:string})=>c.text || '').join('\n') : result.choices?.[0]?.message?.content || '';
      await prisma.$transaction([
        prisma.activity.create({data:{teamId:task.teamId,memberId:agent.memberId,taskId,type:'agent_completed',description:`${agent.name} returned output for review`,meta:JSON.stringify({agentId:id,output:text,usage:{promptTokens:input,completionTokens:output,totalTokens:input+output}})}}),
        prisma.agent.update({where:{id},data:{status:'idle'}}),
        prisma.task.update({where:{id:taskId},data:{status:'review'}}),
      ]);
    } catch(e) {
      if(runs.get(id) !== controller) return;
      await prisma.$transaction([
        prisma.agent.update({where:{id},data:{status:'error'}}),
        prisma.activity.create({data:{teamId:task.teamId,memberId:agent.memberId,taskId,type:'agent_error',description:controller.signal.aborted ? 'Agent request timed out' : (e as Error).message,meta:JSON.stringify({agentId:id})}}),
      ]).catch(console.error);
    } finally {clearTimeout(timeout);if(runs.get(id) === controller) runs.delete(id);}
  })();
  return {id,status:'working'};
}

export async function stopAgent(id: string) {
  const controller=runs.get(id);runs.delete(id);controller?.abort();
  const agent=await prisma.agent.findUnique({where:{id},include:{member:true}});
  if(!agent) throw new Error('Agent not found');
  return prisma.$transaction(async tx => {
    const updated=await tx.agent.update({where:{id},data:{status:'idle'}});
    await tx.activity.create({data:{teamId:agent.member.teamId,memberId:agent.memberId,type:'agent_stopped',description:`${agent.name} stopped`,meta:JSON.stringify({agentId:id})}});
    return updated;
  });
}
