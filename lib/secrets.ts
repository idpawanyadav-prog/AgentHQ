import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import path from 'path';

function key() {
  if (process.env.GATEWAY_ENCRYPTION_KEY) {
    const value = Buffer.from(process.env.GATEWAY_ENCRYPTION_KEY, 'hex');
    if (value.length !== 32) throw new Error('GATEWAY_ENCRYPTION_KEY must contain 64 hex characters');
    return value;
  }
  const directory = path.join(process.cwd(), '.local');
  const file = path.join(directory, 'gateway.key');
  mkdirSync(directory, { recursive: true });
  try { return readFileSync(file); } catch {
    try { writeFileSync(file, randomBytes(32), { flag: 'wx', mode: 0o600 }); } catch (e) {
      if ((e as NodeJS.ErrnoException).code !== 'EEXIST') throw e;
    }
    return readFileSync(file);
  }
}
export function encrypt(secret: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const data = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), data].map(b => b.toString('base64')).join('.');
}
export function decrypt(secret: string) {
  const [iv, tag, data] = secret.split('.').map(v => Buffer.from(v, 'base64'));
  const cipher = createDecipheriv('aes-256-gcm', key(), iv);
  cipher.setAuthTag(tag);
  return Buffer.concat([cipher.update(data), cipher.final()]).toString('utf8');
}
