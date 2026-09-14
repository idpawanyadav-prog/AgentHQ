import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { authConfig, authenticated, session, newSecret } from '../../lib/auth';
const attempts = new Map<string,{count:number;until:number}>();
export default async function handler(req: NextApiRequest,res: NextApiResponse) {
  const config = await authConfig();
  if(req.method === 'GET') return res.json({authenticated:await authenticated(req),needsSetup:!config});
  if(req.method !== 'POST') return res.status(405).json({error:'Method not allowed'});
  if(req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({error:'Invalid origin'});
  if(req.body.action === 'logout') { res.setHeader('Set-Cookie','dashboard_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');return res.json({success:true}); }
  const ip=req.socket.remoteAddress || 'unknown';
  let attempt=attempts.get(ip); if(!attempt || attempt.until < Date.now()) { attempt={count:0,until:Date.now()+60000};attempts.set(ip,attempt); }
  if(++attempt.count > 10) return res.status(429).json({error:'Too many attempts. Try again in one minute.'});
  const password=req.body.password;
  if(typeof password !== 'string' || password.length < 12 || password.length > 256) return res.status(400).json({error:'Use a password between 12 and 256 characters'});
  let secret=config?.secret;
  if(!config) {
    if(!['127.0.0.1','::1','::ffff:127.0.0.1'].includes(ip)) return res.status(403).json({error:'Initial setup must be performed on this computer'});
    secret=newSecret();
    try { await prisma.setting.create({data:{key:'dashboard_auth',value:JSON.stringify({hash:await bcrypt.hash(password,12),secret})}}); }
    catch { return res.status(409).json({error:'Setup already completed. Sign in instead.'}); }
  } else if(!await bcrypt.compare(password,config.hash)) return res.status(401).json({error:'Invalid password'});
  attempts.delete(ip);
  const secure=req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
  res.setHeader('Set-Cookie',`dashboard_session=${session(secret!)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
  return res.json({success:true});
}
