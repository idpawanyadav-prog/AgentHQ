import {withAuth} from '../../../lib/auth';
import {startAgent,stopAgent} from '../../../lib/agent-runner';
import {getJob,listJobs,cancelJob} from '../../../lib/job-queue';
export default withAuth(async(req,res)=>{
 const parts=req.query.path;
 if(!Array.isArray(parts))return res.status(400).json({error:'Invalid path'});
 if(parts[0]==='agent' && parts[1]) {
  if(req.method==='GET' && parts.length===2)return res.json({jobs:await listJobs({agentId:parts[1]})});
  if(req.method==='POST' && parts[2]==='start') {
   if(typeof req.body.taskId!=='string')return res.status(400).json({error:'taskId required'});
   return res.status(202).json(await startAgent(parts[1],req.body.taskId));
  }
  if(req.method==='POST' && parts[2]==='stop')return res.json(await stopAgent(parts[1]));
 }
 if(parts.length===2 && parts[1]==='status' && req.method==='GET') {
  const job=await getJob(parts[0]);return job?res.json(job):res.status(404).json({error:'Job not found'});
 }
 if(parts.length===2 && parts[1]==='cancel' && req.method==='POST')return await cancelJob(parts[0])?res.json({cancelled:true}):res.status(409).json({error:'Job is missing or terminal'});
 return res.status(404).json({error:'Not found'});
});
