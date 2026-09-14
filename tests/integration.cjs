// Runs against an isolated copy of the database and a local mock provider.
const {spawn}=require('child_process');
const fs=require('fs');
const path=require('path');
const http=require('http');
const assert=require('assert/strict');
const {PrismaClient}=require('@prisma/client');
const root=path.resolve(__dirname,'..');
const db=path.join(root,'.local',`integration-${Date.now()}.db`);
fs.mkdirSync(path.dirname(db),{recursive:true});
fs.copyFileSync(path.join(root,'prisma','dev.db'),db);
const prisma=new PrismaClient({datasources:{db:{url:`file:${db.replace(/\\/g,'/')}`}}});
let child,provider,cookie='';
const base='http://127.0.0.1:3100';
async function request(url,body,method=body?'POST':'GET',expected=200) {
 const r=await fetch(base+url,{method,headers:{'Content-Type':'application/json',cookie},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(15000)});
 const text=await r.text();
 assert.equal(r.status,expected,`${url}: ${text.slice(0,300)}`);
 if(r.headers.get('set-cookie')) cookie=r.headers.get('set-cookie').split(';')[0];
 return text?JSON.parse(text):null;
}
async function waitFor(fn) {
 for(let i=0;i<60;i++){if(await fn())return;await new Promise(r=>setTimeout(r,200));}
 throw new Error('Timed out waiting for state');
}
(async()=>{
 await prisma.setting.deleteMany({where:{key:'dashboard_auth'}});
 await prisma.gateway.deleteMany();
 provider=http.createServer((req,res)=>{
  let body='';req.on('data',c=>body+=c);req.on('end',()=>{
   const input=JSON.parse(body || '{}');
   const delay=input.model==='slow-model'?4000:50;
   setTimeout(()=>{res.setHeader('Content-Type','application/json');res.end(JSON.stringify({choices:[{message:{content:'Verified provider output'}}],usage:{prompt_tokens:11,completion_tokens:7,total_tokens:18}}));},delay);
  });
 });
 await new Promise(r=>provider.listen(0,'127.0.0.1',r));
 child=spawn(process.execPath,[path.join(root,'node_modules/next/dist/bin/next'),'start','-p','3100'],{cwd:root,windowsHide:true,env:{...process.env,DATABASE_URL:`file:${db.replace(/\\/g,'/')}`},stdio:['ignore','pipe','pipe']});
 let logs='';child.stdout.on('data',c=>logs+=c);child.stderr.on('data',c=>logs+=c);
 await waitFor(async()=>{try{return (await fetch(base+'/api/auth')).ok;}catch{return false;}});
 await request('/api/teams',null,'GET',401);
 assert.equal((await request('/api/auth')).needsSetup,true);
 await request('/api/auth',{password:'integration-test-password-123'});
 assert.equal((await request('/api/auth')).authenticated,true);
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
 await waitFor(async()=> (await prisma.agent.findUnique({where:{id:agent.id}})).status==='idle');
 assert.equal((await prisma.task.findUnique({where:{id:task.id}})).status,'review');
 const completed=await prisma.activity.findFirst({where:{taskId:task.id,type:'agent_completed'}});
 assert.equal(JSON.parse(completed.meta).output,'Verified provider output');
 assert.equal(JSON.parse(completed.meta).usage.totalTokens,18);
 assert.ok((await request('/api/cost')).totalTokens>=18);
 await request(`/api/agents/${agent.id}`,{model:'slow-model'},'PUT');
 await request(`/api/agents/${agent.id}/start`,{taskId:task.id},'POST',202);
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
 child?.kill();provider?.closeAllConnections();provider?.close();await prisma.$disconnect();
});
