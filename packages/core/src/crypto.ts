import crypto from 'node:crypto';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96 bits recommended for GCM
const AUTH_TAG_LENGTH = 16; // 128 bits

function getDerivedKey(key?: string): Buffer {
  const masterSecret = key || process.env.ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET || 'recoverflow_master_encryption_key_32bytes!';
  // Deterministically derive 32 bytes for AES-256
  return crypto.createHash('sha256').update(masterSecret).digest();
}

export interface EncryptedPayload {
  iv: string;
  authTag: string;
  ciphertext: string;
}

/**
 * Encrypts a sensitive plaintext string using AES-256-GCM with a unique 96-bit IV.
 * Returns a serialized format: `iv:authTag:ciphertext` (all hex encoded).
 */
export function encryptCredential(plaintext: string, secretKey?: string): string {
  if (!plaintext) return '';
  const key = getDerivedKey(secretKey);
  const iv = crypto.randomBytes(IV_LENGTH);

  const cipher = crypto.createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');

  const authTag = cipher.getAuthTag().toString('hex');
  const ivHex = iv.toString('hex');

  return `${ivHex}:${authTag}:${encrypted}`;
}

/**
 * Decrypts an AES-256-GCM serialized payload (`iv:authTag:ciphertext`).
 * Verifies the 128-bit authentication tag before returning plaintext.
 */
export function decryptCredential(serialized: string, secretKey?: string): string {
  if (!serialized) return '';
  const parts = serialized.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format: expected iv:authTag:ciphertext');
  }

  const [ivHex, authTagHex, ciphertextHex] = parts;
  const key = getDerivedKey(secretKey);
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH });
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(ciphertextHex, 'hex', 'utf8');
  decrypted += decipher.final('utf8');

  return decrypted;
}
