const prisma=require('./prisma');
// Observe committed state across web and worker processes; clients receive push events.
function startRealtimeMonitor(io) {
 let active=true,timer,previous=new Map(),initialized=false;
 async function scan() {
  try {
   const groups=await Promise.all([
    prisma.task.findMany({select:{id:true,status:true,updatedAt:true,teamId:true,agentId:true}}),
    prisma.agent.findMany({select:{id:true,status:true,updatedAt:true}}),
    prisma.activity.findMany({orderBy:{createdAt:'desc'},take:100}),
    prisma.job.findMany({select:{id:true,status:true,error:true},orderBy:{createdAt:'desc'},take:100}),
    prisma.team.findMany({select:{id:true,updatedAt:true}}),
    prisma.project.findMany({select:{id:true,updatedAt:true}}),
    prisma.sprint.findMany({select:{id:true,updatedAt:true}}),
   ]);
   const next=new Map();let changed=false;
   groups.forEach((rows,index)=>rows.forEach(row=>{
    const key=`${index}:${row.id}`,value=JSON.stringify(row);next.set(key,value);
    if(initialized && previous.get(key)!==value) {
     changed=true;
     if(index===0)io.to('admin').emit('task:updated',row);
     if(index===1)io.to('admin').emit('agent:status',{agentId:row.id,status:row.status});
     if(index===2)io.to('admin').emit('activity:new',{...row,meta:JSON.parse(row.meta || '{}')});
     if(index===3)io.to('admin').emit('job:updated',{jobId:row.id,status:row.status,error:row.error});
    }
   }));
   if(initialized && previous.size!==next.size)changed=true;
   previous=next;initialized=true;if(changed)io.to('admin').emit('data:changed');
  } catch(error){console.error(JSON.stringify({event:'realtime_scan_failed',message:error.message}));}
  finally {if(active)timer=setTimeout(scan,750);}
 }
 scan();return()=>{active=false;clearTimeout(timer);};
}
module.exports={startRealtimeMonitor};
