import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from '../../packages/core/src/password';
describe('Operator credential verification', () => {
  it('salts passwords uniquely and verifies the correct password', async () => {
    const password = 'A unique test passphrase!';
    const a = await hashPassword(password);
    const b = await hashPassword(password);
    expect(a).not.toBe(b);
    expect(await verifyPassword(password, a)).toBe(true);
    expect(await verifyPassword('incorrect password', a)).toBe(false);
    expect(await verifyPassword(password, null)).toBe(false);
    expect(await verifyPassword(password, 'malformed')).toBe(false);
  });
  it('rejects short and unbounded passwords', async () => {
    await expect(hashPassword('short')).rejects.toThrow();
    await expect(hashPassword('x'.repeat(257))).rejects.toThrow();
    expect(await verifyPassword('x'.repeat(257), null)).toBe(false);
  });
});
