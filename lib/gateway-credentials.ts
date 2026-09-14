import prisma from './prisma';
import { decrypt } from './secrets';
export async function gatewayCredentials(body: Record<string, any>) {
  if (body.apiKey !== '********') return body;
  if (typeof body.gatewayId !== 'string') throw new Error('Select a saved gateway');
  const gateway = await prisma.gateway.findUnique({where:{id:body.gatewayId}});
  if (!gateway) throw new Error('Gateway not found');
  return {...body, baseUrl:gateway.baseUrl,provider:gateway.provider,apiKey:decrypt(gateway.apiKey)};
}
