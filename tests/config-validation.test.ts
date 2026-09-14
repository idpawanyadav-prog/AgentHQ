describe('gateway encryption key validation', () => {
 const originalEnv = process.env;

 beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
 });

 afterAll(() => {
  process.env = originalEnv;
 });

 function encryptWithKey(encryptionKey: string | undefined, nodeEnv = 'production') {
  Object.assign(process.env, { NODE_ENV: nodeEnv });
  if (encryptionKey === undefined) delete process.env.GATEWAY_ENCRYPTION_KEY;
  else process.env.GATEWAY_ENCRYPTION_KEY = encryptionKey;
  return require('../lib/secrets').encrypt('secret');
 }

 it('accepts a 64-character hex key', () => {
  expect(encryptWithKey('ab'.repeat(32))).toEqual(expect.any(String));
 });

 it('rejects missing production keys', () => {
  expect(() => encryptWithKey(undefined)).toThrow('GATEWAY_ENCRYPTION_KEY is required in production');
 });

 it('rejects 31-byte keys', () => {
  expect(() => encryptWithKey('ab'.repeat(31))).toThrow('GATEWAY_ENCRYPTION_KEY must contain 64 hex characters');
 });

 it('rejects 33-byte keys', () => {
  expect(() => encryptWithKey('ab'.repeat(33))).toThrow('GATEWAY_ENCRYPTION_KEY must contain 64 hex characters');
 });

 it('rejects non-hex input', () => {
  expect(() => encryptWithKey('z'.repeat(64))).toThrow('GATEWAY_ENCRYPTION_KEY must contain 64 hex characters');
 });
});
