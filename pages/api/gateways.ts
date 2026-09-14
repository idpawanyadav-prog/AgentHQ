import { withAuth } from '../../lib/auth';
import type { NextApiRequest, NextApiResponse } from 'next';
import prisma from '../../lib/prisma';
import { encrypt } from '../../lib/secrets';
async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const gateways = await prisma.gateway.findMany();
    return res.json({ gateways: gateways.map(g => ({...g, apiKey: '********'})), defaultGatewayId: gateways.find(g => g.isDefault)?.id || '' });
  }
  if (req.method !== 'PUT') return res.status(405).json({error:'Method not allowed'});
  const {gateways, defaultGatewayId} = req.body;
  if (!Array.isArray(gateways)) return res.status(400).json({error:'gateways must be an array'});
  const existing = await prisma.gateway.findMany();
  const records: {id:string;name:string;model:string;provider:string;baseUrl:string;apiKey:string;isDefault:boolean}[] = [];
  for (const g of gateways) {
    if (![g.id,g.name,g.model,g.baseUrl,g.apiKey].every(v => typeof v === 'string' && v.trim()) || !['openai','anthropic','custom'].includes(g.provider)) return res.status(400).json({error:'Invalid gateway'});
    try { if (!['http:','https:'].includes(new URL(g.baseUrl).protocol)) throw new Error(); } catch { return res.status(400).json({error:'Invalid gateway URL'}); }
    const previous = existing.find(row => row.id === g.id);
    if (g.apiKey === '********' && !previous) return res.status(400).json({error:'API key required'});
    records.push({id:g.id,name:g.name,model:g.model,provider:g.provider,baseUrl:g.baseUrl,apiKey:g.apiKey === '********' ? previous!.apiKey : encrypt(g.apiKey),isDefault:g.id === defaultGatewayId});
  }
  await prisma.$transaction(async tx => {
    await tx.gateway.deleteMany({where:{id:{notIn:records.map(g => g.id)}}});
    for (const g of records) await tx.gateway.upsert({where:{id:g.id},create:g,update:g});
  });
  return res.json({success:true});
}

export default withAuth(handler);
