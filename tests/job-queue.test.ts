import {completeJob,cancelJob,enqueueJob,type JobRecord} from '../lib/job-queue';
import prisma from '../lib/prisma';
jest.mock('../lib/prisma',()=>({__esModule:true,default:{job:{create:jest.fn(),findUnique:jest.fn(),updateMany:jest.fn()},agent:{updateMany:jest.fn(),findUnique:jest.fn(),update:jest.fn()},task:{updateMany:jest.fn()},activity:{create:jest.fn()},$transaction:jest.fn()}}));
const db=prisma as any;
beforeEach(()=>{jest.clearAllMocks();db.$transaction.mockImplementation((fn:any)=>fn(db));});
test('queued payloads are serialized for SQLite',async()=>{
 db.job.create.mockImplementation(({data}:any)=>({...data,id:'job',result:null}));
 const job=await enqueueJob({agentId:'agent',taskId:'task',teamId:'team',config:{},model:'model',provider:'openai',messages:[]});
 expect(typeof db.job.create.mock.calls[0][0].data.payload).toBe('string');expect(job.payload.agentId).toBe('agent');
});
test('a cancelled or stale lease cannot publish output or change an agent',async()=>{
 db.job.updateMany.mockResolvedValue({count:0});
 expect(await completeJob({id:'job',attempts:2} as JobRecord,{output:'late',usage:{promptTokens:1,completionTokens:1,totalTokens:2},latencyMs:1})).toBe(false);
 expect(db.job.updateMany.mock.calls[0][0].where).toMatchObject({status:'running',cancelled:false,attempts:2});
 expect(db.agent.update).not.toHaveBeenCalled();expect(db.activity.create).not.toHaveBeenCalled();
});
test('completed jobs cannot be cancelled retroactively',async()=>{
 db.job.findUnique.mockResolvedValue({id:'job',status:'completed'});
 expect(await cancelJob('job')).toBe(false);expect(db.job.updateMany).not.toHaveBeenCalled();
});
