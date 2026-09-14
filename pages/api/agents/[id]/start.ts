import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import { startAgent } from '../../../../lib/agent-runner';
export default withAuth(async (req: NextApiRequest,res: NextApiResponse) => {
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if(typeof req.query.id !== 'string' || typeof req.body.taskId !== 'string') return res.status(400).json({error:'Agent and task IDs are required'});
  try {return res.status(202).json(await startAgent(req.query.id,req.body.taskId));}
  catch(e) {return res.status(400).json({error:(e as Error).message});}
});
