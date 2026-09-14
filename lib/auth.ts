import type { NextApiHandler, NextApiRequest, NextApiResponse } from 'next';
import { createHmac, timingSafeEqual, randomBytes } from 'crypto';
import prisma from './prisma';

export async function authConfig() {
 const row = await prisma.setting.findUnique({ where: { key: 'dashboard_auth' } });
 return row ? JSON.parse(row.value) as { hash: string; secret: string } : null;
}

export async function setupToken() {
 const row = await prisma.setting.findUnique({ where: { key: 'dashboard_setup_token' } });
 return row ? JSON.parse(row.value) as { token?: string; tokenHash?:string; expiresAt?:number; used: boolean } : null;
}

export function session(secret: string) {
 const expires = String(Date.now() + 12 * 60 * 60 * 1000);
 return expires + '.' + createHmac('sha256', secret).update(expires).digest('hex');
}

export async function authenticated(req: NextApiRequest) {
 const config = await authConfig();
 if (!config) return false;
 const [expires, signature] = (req.cookies.dashboard_session || '').split('.');
 if (!expires || !signature || !Number.isFinite(Number(expires)) || Number(expires) < Date.now()) return false;
 const expected = createHmac('sha256', config.secret).update(expires).digest('hex');
 return signature.length === expected.length && timingSafeEqual(Buffer.from(signature), Buffer.from(expected));
}

export function withAuth(handler: NextApiHandler) {
 return async (req: NextApiRequest, res: NextApiResponse) => {
 if (!await authenticated(req)) return res.status(401).json({ error: 'Sign in required' });
 if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method || '')) {
 const origin = req.headers.origin;
 if (origin && new URL(origin).host !== req.headers.host) return res.status(403).json({ error: 'Invalid origin' });
 }
 try { return await handler(req, res); }
 catch (e) {
 const code = (e as { code?: string }).code;
 if (code === 'P2025') return res.status(404).json({ error: 'Record not found' });
 if (code === 'P2002') return res.status(409).json({ error: 'This record already exists or is already assigned' });
 if (code === 'P2003') return res.status(400).json({ error: 'Related record is missing or still in use' });
 console.error(e);
 return res.status(500).json({ error: 'Request failed' });
 }
 };
}

export const newSecret = () => randomBytes(32).toString('hex');
export const generateSetupToken = () => randomBytes(32).toString('hex');
