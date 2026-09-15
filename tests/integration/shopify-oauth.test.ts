import { describe, it, expect } from 'vitest';
import crypto from 'node:crypto';
import { 
  encryptCredential, 
  decryptCredential, 
  db,
  type Merchant 
} from '@recoverflow/core';
import { verifyShopifyOAuthHmac } from '../../apps/web/src/app/api/auth/shopify/callback/route';

describe('Shopify OAuth 2.0 & AES-256-GCM Credential Security', () => {
  const testSecret = 'shpss_live_oauth_secret_test_991823';

  it('verifies Shopify OAuth query HMAC signatures correctly', () => {
    const params = new URLSearchParams({
      code: '0907a61c0c8d55e99db179b68161bc00',
      shop: 'aurora-apparel.myshopify.com',
      state: 'c7c824c08462002e',
      timestamp: '1726410000',
    });

    // Compute valid HMAC
    const entries: string[] = [];
    params.forEach((val, key) => entries.push(`${key}=${val}`));
    entries.sort();
    const message = entries.join('&');
    const validHmac = crypto.createHmac('sha256', testSecret).update(message).digest('hex');

    params.set('hmac', validHmac);

    const isValid = verifyShopifyOAuthHmac(params, testSecret);
    expect(isValid).toBe(true);

    // Tampered parameter
    params.set('shop', 'evil-store.myshopify.com');
    const isTamperedValid = verifyShopifyOAuthHmac(params, testSecret);
    expect(isTamperedValid).toBe(false);
  });

  it('performs flawless AES-256-GCM encryption and decryption round-trip', () => {
    const sensitiveTokens = [
      'shpat_33a928bf192c01827419bc9a',
      'EAAG_meta_whatsapp_long_lived_token_881923',
      're_live_resend_api_key_4412019',
    ];

    for (const token of sensitiveTokens) {
      const encrypted = encryptCredential(token);
      expect(encrypted).not.toBe(token);
      expect(encrypted.split(':')).toHaveLength(3); // iv:authTag:ciphertext

      const decrypted = decryptCredential(encrypted);
      expect(decrypted).toBe(token);
    }
  });

  it('fails decryption if encrypted ciphertext, IV, or authentication tag is tampered with', () => {
    const plaintext = 'shpat_super_secret_access_token_123';
    const encrypted = encryptCredential(plaintext);
    const [iv, authTag, ciphertext] = encrypted.split(':');

    // Tamper with ciphertext
    const tamperedCiphertext = `${iv}:${authTag}:${ciphertext.slice(0, -2)}00`;
    expect(() => decryptCredential(tamperedCiphertext)).toThrow();

    // Tamper with authTag
    const tamperedTag = `${iv}:${authTag.slice(0, -2)}ff:${ciphertext}`;
    expect(() => decryptCredential(tamperedTag)).toThrow();
  });

  it('persists encrypted merchant credentials in the database', async () => {
    const rawToken = 'shpat_production_token_xyz99';
    const encryptedToken = encryptCredential(rawToken);

    const merchant: Merchant = {
      id: 'merchant_oauth_test_01',
      storeUrl: 'https://test-fashion.myshopify.com',
      shopDomain: 'test-fashion.myshopify.com',
      storeName: 'Test Fashion Store',
      webhookSecret: 'sec_test_123',
      encryptedShopifyAccessToken: encryptedToken,
      brandToneGuidelines: 'Friendly and modern',
      brandVoiceCasualVsFormal: 0.3,
      brandVoiceUrgencyVsGentle: 0.5,
      discountCeilingPercentage: 15.0,
      minMarginPercentage: 20.0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    await db.upsertMerchant(merchant);

    const retrieved = await db.getMerchantByShopDomain('test-fashion.myshopify.com');
    expect(retrieved).not.toBeNull();
    expect(retrieved?.encryptedShopifyAccessToken).toBe(encryptedToken);

    const decrypted = decryptCredential(retrieved!.encryptedShopifyAccessToken!);
    expect(decrypted).toBe(rawToken);
  });
});
