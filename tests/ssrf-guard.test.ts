import { parseSafeUrl, isPrivateAddress, assertSafeAddress } from '../lib/ssrf-guard';

describe('isPrivateAddress', () => {
 it('rejects loopback IPv4', () => { expect(isPrivateAddress('127.0.0.1')).toBe(true); expect(isPrivateAddress('127.0.0.2')).toBe(true); });
 it('rejects link-local (metadata)', () => { expect(isPrivateAddress('169.254.169.254')).toBe(true); });
 it('rejects private ranges', () => { expect(isPrivateAddress('10.0.0.1')).toBe(true); expect(isPrivateAddress('172.16.0.1')).toBe(true); expect(isPrivateAddress('192.168.1.1')).toBe(true); });
 it('rejects CGNAT', () => { expect(isPrivateAddress('100.64.0.1')).toBe(true); });
 it('rejects multicast/reserved', () => { expect(isPrivateAddress('224.0.0.1')).toBe(true); expect(isPrivateAddress('240.0.0.1')).toBe(true); });
 it('rejects IPv6 loopback', () => { expect(isPrivateAddress('::1')).toBe(true); });
 it('rejects IPv6 link-local', () => { expect(isPrivateAddress('fe80::1')).toBe(true); });
 it('rejects IPv4-mapped IPv6', () => { expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true); });
 it('allows public addresses', () => { expect(isPrivateAddress('1.1.1.1')).toBe(false); expect(isPrivateAddress('8.8.8.8')).toBe(false); });
});

describe('parseSafeUrl', () => {
 it('rejects non-HTTP schemes', async () => { await expect(parseSafeUrl('file:///etc/passwd')).rejects.toThrow(); });
 it('rejects localhost', async () => { await expect(parseSafeUrl('http://localhost:8080')).rejects.toThrow(); });
 it('rejects loopback IP', async () => { await expect(parseSafeUrl('http://127.0.0.1:3000')).rejects.toThrow(); });
 it('rejects metadata IP', async () => { await expect(parseSafeUrl('http://169.254.169.254/latest')).rejects.toThrow(); });
 it('rejects private IP in URL', async () => { await expect(parseSafeUrl('http://10.0.0.1/admin')).rejects.toThrow(); });
});

describe('assertSafeAddress', () => {
 it('throws for private IP', () => { expect(() => assertSafeAddress('192.168.1.1')).toThrow(); });
 it('passes for public IP', () => { expect(() => assertSafeAddress('93.184.216.34')).not.toThrow(); });
});
