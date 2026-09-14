// Runs against an isolated copy of the database and a local mock provider.
const {spawn,spawnSync}=require('child_process');
const fs=require('fs');
const path=require('path');
const http=require('http');
const assert=require('assert/strict');
const {PrismaClient}=require('@prisma/client');
const root=path.resolve(__dirname,'..');
const db=path.join(root,'.local',`integration-${Date.now()}.db`);
fs.mkdirSync(path.dirname(db),{recursive:true});
fs.writeFileSync(db,'');
const databaseUrl=`file:${db.replace(/\\/g,'/')}`;
const migration=spawnSync(process.execPath,[path.join(root,'node_modules/prisma/build/index.js'),'migrate','deploy'],{cwd:root,env:{...process.env,DATABASE_URL:databaseUrl},encoding:'utf8'});
if(migration.status!==0) throw new Error(migration.stdout+ migration.stderr);
const prisma=new PrismaClient({datasources:{db:{url:`file:${db.replace(/\\/g,'/')}`}}});
let child,worker,realtime,socket,provider,cookie='';
const base='http://127.0.0.1:3100';
let nextLogs='';
let workerLogs='';
let realtimeLogs='';
function processState(name,proc) {
 return {
  name,
  pid: proc?.pid,
  exitCode: proc?.exitCode,
  signalCode: proc?.signalCode,
  killed: proc?.killed,
 };
}
function collectLogs(proc,append) {
 proc.stdout.on('data',c=>append(c));
 proc.stderr.on('data',c=>append(c));
}
function startupDiagnostics() {
 return [
  'Next process state',
  JSON.stringify(processState('next',child),null,2),
  'Realtime process state',
  JSON.stringify(processState('realtime',realtime),null,2),
  'Worker process state',
  JSON.stringify(processState('worker',worker),null,2),
  'Next logs',
  nextLogs,
  'Realtime logs',
  realtimeLogs,
  'Worker logs',
  workerLogs,
 ].join('\n');
}
async function request(url,body,method=body?'POST':'GET',expected=200) {
 const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const text=await r.text();
 assert.equal(r.status,expected,`${url}: ${text.slice(0,300)}`);
 if(r.headers.get('set-cookie')) cookie=r.headers.get('set-cookie').split(';')[0];
 return text?JSON.parse(text):null;
}
async function waitFor(name,fn,diagnostics) {
 for(let i=0;i<60;i++){if(await fn())return;await new Promise(r=>setTimeout(r,200));}
 console.error(`Timed out waiting for: ${name}`);
 if(diagnostics) console.error(diagnostics());
 throw new Error(`Timed out waiting for ${name}`);
}
(async()=>{
 await prisma.setting.deleteMany({where:{key:'dashboard_auth'}});
 await prisma.setting.deleteMany({where:{key:'dashboard_setup_token'}});
 await prisma.gateway.deleteMany();
 const token = 'integration-setup-token-' + Date.now();
 await prisma.setting.create({data:{key:'dashboard_setup_token',value:JSON.stringify({token,used:false})}});
 provider=http.createServer((req,res)=>{
  let body='';req.on('data',c=>body+=c);req.on('end',()=>{
   const input=JSON.parse(body || '{}');
   const delay=input.model==='slow-model'?4000:50;
   setTimeout(()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'Verified provider output'}}],usage:{prompt_tokens:11,completion_tokens:7,total_tokens:18}}));},delay);
  });
 });
 await new Promise(r=>provider.listen(0,'127.0.0.1',r));
 const testEnv={...process.env,DATABASE_URL:databaseUrl,GATEWAY_ALLOWED_ORIGINS:`http://127.0.0.1:${provider.address().port}`,GATEWAY_ENCRYPTION_KEY:'ab'.repeat(32),NEXTAUTH_URL:base,PORT:'4100',WEB_ORIGIN:base};
 child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p','3100'],{cwd:root,windowsHide:true,env:testEnv,stdio:['ignore','pipe','pipe']});
 worker=spawn(process.execPath,[path.join(root,'node_modules/tsx/dist/cli.mjs'),'server/worker.ts'],{cwd:root,windowsHide:true,env:testEnv,stdio:'pipe'});
 realtime=spawn(process.execPath,['server/index.js'],{cwd:root,windowsHide:true,env:testEnv,stdio:'pipe'});
 collectLogs(child,c=>nextLogs+=c);
 collectLogs(worker,c=>workerLogs+=c);
 collectLogs(realtime,c=>realtimeLogs+=c);
 await waitFor('Next.js auth endpoint',async()=>{try{return (await fetch(base+'/api/auth')).ok;}catch{return false;}},startupDiagnostics);
 await request('/api/teams',null,'GET',401);
 assert.equal((await request('/api/auth')).needsSetup,true);
 await request('/api/auth',{password:'integration-test-password-123',token});
 assert.equal((await request('/api/auth')).authenticated,true);
 await waitFor('realtime readiness',async()=>{try{return (await fetch('http://127.0.0.1:4100/ready')).ok;}catch{return false;}},startupDiagnostics);
 socket=require('socket.io-client').io('http://127.0.0.1:4100',{extraHeaders:{Cookie:cookie,Origin:base},transports:['websocket']});
 await new Promise((resolve,reject)=>{socket.on('connect',resolve);socket.on('connect_error',reject);});
 let liveUpdates=0;socket.on('data:changed',()=>liveUpdates++);
 const team=await request('/api/teams',{name:'Integration team'},'POST',201);
 const member=await prisma.member.create({data:{name:'Integration member',role:'Developer',type:'ai',teamId:team.id}});
 const project=await request('/api/projects',{name:'Integration project',teamId:team.id},'POST',201);
 await request('/api/sprints',{name:'Missing project'},'POST',400);
 const sprint=await request('/api/sprints',{name:'Integration sprint',projectId:project.id},'POST',201);
 const agent=await request('/api/agents',{name:'Integration agent',type:'openai',model:'test-model',memberId:member.id},'POST',201);
 const task=(await request('/api/tasks',{title:'Integration task',description:'Test the workflow',teamId:team.id,projectId:project.id,sprintId:sprint.id,acceptanceCriteria:[{text:'Output is recorded',done:false}]},'POST',201)).data;
 assert.equal(JSON.parse(task.acceptanceCriteria)[0].text,'Output is recorded');
 await request(`/api/tasks/${task.id}/assign`,{agentId:agent.id});
 await request(`/api/tasks/${task.id}/status`,{status:'ready'});
 const gateway={id:'integration-gateway',name:'Mock',provider:'openai',model:'test-model',baseUrl:`http://127.0.0.1:${provider.address().port}`,apiKey:'mock-secret-key'};
 await request('/api/gateways',{gateways:[gateway],defaultGatewayId:gateway.id},'PUT');
 assert.equal((await request('/api/gateways')).gateways[0].apiKey,'********');
 assert.notEqual((await prisma.gateway.findUnique({where:{id:gateway.id}})).apiKey,gateway.apiKey);
 await request(`/api/agents/${agent.id}/start`,{taskId:task.id},'POST',202);
 await waitFor('agent job completion',async()=> (await prisma.agent.findUnique({where:{id:agent.id}})).status==='idle',startupDiagnostics);
 assert.equal((await prisma.task.findUnique({where:{id:task.id}})).status,'review');
 const completed=await prisma.activity.findFirst({where:{taskId:task.id,type:'agent_completed'}});
 assert.equal(JSON.parse(completed.meta).output,'Verified provider output');
 assert.equal(JSON.parse(completed.meta).usage.totalTokens,18);
 assert.ok((await request('/api/cost')).totalTokens>=18);
 await waitFor('realtime event',async()=>liveUpdates>0,startupDiagnostics);
 await request(`/api/agents/${agent.id}`,{model:'slow-model'},'PUT');
 await request(`/api/agents/${agent.id}/start`,{taskId:task.id},'POST',202);
 await waitFor('running job',async()=>!!await prisma.job.findFirst({where:{agentId:agent.id,status:'running'}}),startupDiagnostics);
 await request(`/api/agents/${agent.id}/stop`,{});
 await new Promise(r=>setTimeout(r,4300));
 assert.equal((await prisma.agent.findUnique({where:{id:agent.id}})).status,'idle');
 assert.equal(await prisma.activity.count({where:{taskId:task.id,type:'agent_completed'}}),1);
 const settings=await request('/api/settings');assert.equal(settings.dashboard_auth,undefined);
 await request('/api/settings',{dashboard_auth:'invalid'},'PUT',400);
 await request('/api/reports');
 await request(`/api/tasks/${task.id}`,null,'DELETE');
 await request('/api/auth',{action:'logout'});
 await request('/api/agents',null,'GET',401);
 console.log('PASS: authentication, CRUD, criteria, assignment, status, encrypted gateways, agent execution, cancellation, usage, reports, logout');
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(async()=>{
 socket?.disconnect();worker?.kill();realtime?.kill();child?.kill();provider?.closeAllConnections();provider?.close();await prisma.$disconnect();
});
