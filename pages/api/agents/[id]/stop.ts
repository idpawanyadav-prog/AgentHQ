import type { NextApiRequest, NextApiResponse } from 'next';
import { withAuth } from '../../../../lib/auth';
import { stopAgent } from '../../../../lib/agent-runner';
export default withAuth(async (req: NextApiRequest,res: NextApiResponse) => {
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if(typeof req.query.id !== 'string') return res.status(400).json({error:'Agent ID required'});
  try {return res.json(await stopAgent(req.query.id));}
  catch(e) {return res.status(400).json({error:(e as Error).message});}
});
