import { lookup } from 'dns/promises';
import type { LookupAddress } from 'dns';
import net from 'net';

/**
 * SSRF guard for outbound requests initiated by the server.
 *
 * Goal: prevent an attacker from configuring a custom gateway URL that causes
 * the server to fetch loopback/private/link-local addresses (e.g. the EC2
 * metadata service at 169.254.169.254).
 *
 * Strategy:
 * - Reject obviously dangerous URL schemes and hostnames at the URL level.
 * - Resolve the host once via DNS, validate every returned IP against a blocklist.
 * - For each connection attempt, the caller should re-check the resolved IP
 * against the same blocklist so a DNS rebinding attack cannot bypass the
 * initial check.
 */

const BLOCKED_HOSTNAMES = new Set([
 'localhost',
 'metadata.google.internal',
 'metadata.azure.com',
]);

function isPrivateIPv4(ip: string): boolean {
 const parts = ip.split('.').map(Number);
 if (parts.length !== 4 || parts.some(p => Number.isNaN(p) || p < 0 || p > 255)) return false;
 const [a, b] = parts;
 if (a === 10) return true; // 10.0.0.0/8
 if (a === 127) return true; // 127.0.0.0/8 (loopback)
 if (a === 0) return true; // 0.0.0.0/8
 if (a === 169 && b === 254) return true; // 169.254.0.0/16 (link-local + metadata)
 if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
 if (a === 192 && b === 168) return true; // 192.168.0.0/16
 if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 (CGNAT)
 if (a === 192 && (b === 0 || b === 2)) return true;
 if (a === 198 && (b === 18 || b === 19 || b === 51)) return true;
 if (a === 203 && b === 0 && parts[2] === 113) return true;
 if (a >= 224) return true; // 224.0.0.0/4 multicast, 240/4 reserved
 return false;
}

function isPrivateIPv6(ip: string): boolean {
 const globallyRoutable = new net.BlockList();
 globallyRoutable.addSubnet('2000::', 3, 'ipv6');
 if (!globallyRoutable.check(ip, 'ipv6')) return true;
 const reserved = new net.BlockList();
 reserved.addSubnet('2001::', 23, 'ipv6');
 reserved.addSubnet('2001:db8::',32,'ipv6');
 reserved.addSubnet('2002::',16,'ipv6');
 return reserved.check(ip,'ipv6');
}

export function isPrivateAddress(ip: string): boolean {
 if (net.isIP(ip) === 4) return isPrivateIPv4(ip);
 if (net.isIP(ip) === 6) return isPrivateIPv6(ip);
 return true; // unknown families default to blocked
}

export interface ParsedSafeUrl {
 url: URL;
 addresses: LookupAddress[];
}

export class SsrfError extends Error {
 constructor(message: string) {
 super(message);
 this.name = 'SsrfError';
 }
}

export async function parseSafeUrl(raw: string): Promise<ParsedSafeUrl> {
 let url: URL;
 try { url = new URL(raw); }
 catch { throw new SsrfError('Invalid URL'); }

 if (!['http:', 'https:'].includes(url.protocol)) {
 throw new SsrfError('Only http and https URLs are allowed');
 }

 const host = url.hostname.toLowerCase().replace(/^\[|\]$/g, '').replace(/\.$/, '');
 if(url.username || url.password) throw new SsrfError('URL credentials are not allowed');
 const explicitlyAllowed = (process.env.GATEWAY_ALLOWED_ORIGINS || '').split(',').map(s=>s.trim()).includes(url.origin);
 if (!host) throw new SsrfError('Missing hostname');
 if (!explicitlyAllowed && BLOCKED_HOSTNAMES.has(host)) throw new SsrfError(`Hostname "${host}" is not allowed`);
 if (!explicitlyAllowed && net.isIP(host) && isPrivateAddress(host)) throw new SsrfError('Destination address is private or reserved');

 // Resolve every IP for the host and ensure none are private.
 let addresses: LookupAddress[];
 try {
 const result = await lookup(host, { all: true, verbatim: true });
 if (result.length === 0) throw new Error('No addresses');
 addresses = result;
 } catch {
 throw new SsrfError(`Could not resolve ${host}`);
 }

 for (const addr of addresses) {
 if (!explicitlyAllowed && isPrivateAddress(addr.address)) {
 throw new SsrfError(`Destination ${addr.address} is private or reserved`);
 }
 }

 return { url, addresses };
}

/**
 * Re-check that an IP we'd like to connect to is still safe.
 * Call this just before opening a socket or making an HTTP request, because
 * DNS results can change between resolution and connection (DNS rebinding).
 */
export function assertSafeAddress(ip: string) {
 if (isPrivateAddress(ip)) {
 throw new SsrfError(`Refusing to connect to ${ip}`);
 }
}
