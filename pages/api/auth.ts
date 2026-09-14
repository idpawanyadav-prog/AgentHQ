import {createHash} from 'crypto';
import {allowLogin} from '../../lib/rate-limit';
import type { NextApiRequest, NextApiResponse } from 'next';
import bcrypt from 'bcrypt';
import prisma from '../../lib/prisma';
import { authConfig, authenticated, session, newSecret, setupToken } from '../../lib/auth';


function timingSafeCompare(a: string, b: string): boolean {
 const bufA = Buffer.from(a);
 const bufB = Buffer.from(b);
 if (bufA.length !== bufB.length) return false;
 let result = 0;
 for (let i = 0; i < bufA.length; i++) { result |= bufA[i] ^ bufB[i]; }
 return result === 0;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
 const config = await authConfig();

 if (req.method === 'GET') {
 return res.json({ authenticated: await authenticated(req), needsSetup: !config, setupMode: !config });
 }
 if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
 if (req.headers.origin && new URL(req.headers.origin).host !== req.headers.host) return res.status(403).json({ error: 'Invalid origin' });

 if (req.body.action === 'logout') {
 res.setHeader('Set-Cookie', 'dashboard_session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0');
 return res.json({ success: true });
 }

 const ip = req.socket.remoteAddress || 'unknown';
 if(!await allowLogin(ip))return res.status(429).json({error:'Too many attempts. Try again in one minute.'});

 const password = req.body.password;
 const providedToken = typeof req.body.token === 'string' ? req.body.token.trim() : '';

 if (!config) {
 const envToken = process.env.SETUP_TOKEN;
 const envMatch = envToken ? timingSafeCompare(providedToken, envToken) : false;
 const stored = await setupToken();
 const storedMatch = !!(stored && !stored.used && (!stored.expiresAt || stored.expiresAt>Date.now()) && (stored.tokenHash ? timingSafeCompare(createHash('sha256').update(providedToken).digest('hex'),stored.tokenHash) : !!stored.token && timingSafeCompare(providedToken,stored.token))); 

 if (!envMatch && !storedMatch) {
 return res.status(403).json({ error: 'A setup token is required. Set SETUP_TOKEN in the environment or contact your administrator.' });
 }
 if (!password || typeof password !== 'string' || password.length < 12 || password.length > 256) return res.status(400).json({ error: 'Use a password between 12 and 256 characters' });

 const secret = newSecret();
 try { await prisma.setting.create({ data: { key: 'dashboard_auth', value: JSON.stringify({ hash: await bcrypt.hash(password, 12), secret }) } }); } catch { return res.status(409).json({ error: 'Setup already completed. Sign in instead.' }); }
 if (stored) await prisma.setting.update({ where: { key: 'dashboard_setup_token' }, data: { value: JSON.stringify({ ...stored, used: true }) } }).catch(() => {});

 const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
 res.setHeader('Set-Cookie', `dashboard_session=${session(secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
 return res.json({ success: true });
 }

 if (typeof password !== 'string' || password.length < 12 || password.length > 256) return res.status(400).json({ error: 'Use a password between 12 and 256 characters' });
 if (!await bcrypt.compare(password, config.hash)) return res.status(401).json({ error: 'Invalid password' });

 const secure = req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : '';
 res.setHeader('Set-Cookie', `dashboard_session=${session(config.secret)}; HttpOnly; SameSite=Strict; Path=/; Max-Age=43200${secure}`);
 return res.json({ success: true });
}
