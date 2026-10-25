import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';

const derive = (password: string, salt: string) => new Promise<Buffer>((resolve, reject) => {
  scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 }, (error, key) => {
    if (error) reject(error);
    else resolve(key);
  });
});

export async function hashPassword(password: string): Promise<string> {
  if (password.length < 12 || password.length > 256) throw new Error('Password must contain 12–256 characters.');
  const salt = randomBytes(16).toString('hex');
  return `scrypt-v1$${salt}$${(await derive(password, salt)).toString('hex')}`;
}

export async function verifyPassword(password: string, hash?: string | null): Promise<boolean> {
  if (password.length > 256) return false;
  const parts = hash?.split('$');
  const validHash = parts?.length === 3 && parts[0] === 'scrypt-v1' && /^[a-f0-9]{32}$/.test(parts[1]) && /^[a-f0-9]{128}$/.test(parts[2]);
  // Perform the same expensive operation for unknown users to limit account enumeration.
  const actual = await derive(password, validHash ? parts[1] : '0'.repeat(32));
  const expected = Buffer.from(validHash ? parts[2] : '0'.repeat(128), 'hex');
  return timingSafeEqual(actual, expected) && Boolean(validHash);
}
