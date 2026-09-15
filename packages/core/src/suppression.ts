import { normalizePhone, normalizeEmail } from './security';
import type { SuppressionEntry, SuppressionType } from './types';

export class SuppressionService {
  private localCache = new Map<string, SuppressionEntry>();

  /**
   * Builds the suppression cache key.
   */
  private makeKey(merchantId: string, identifier: string): string {
    return `${merchantId}:${identifier.toLowerCase()}`;
  }

  /**
   * Adds an identifier (phone or email) to the suppression list.
   */
  async suppress(
    merchantId: string,
    rawIdentifier: string,
    type: SuppressionType,
    reason: 'USER_UNSUBSCRIBE' | 'BOUNCE' | 'COMPLAINT' | 'MANUAL' = 'USER_UNSUBSCRIBE'
  ): Promise<SuppressionEntry> {
    const identifier = type === 'PHONE' ? normalizePhone(rawIdentifier) : normalizeEmail(rawIdentifier);
    const entry: SuppressionEntry = {
      id: `supp_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      merchantId,
      identifier,
      type,
      reason,
      optedOutAt: new Date().toISOString(),
    };

    this.localCache.set(this.makeKey(merchantId, identifier), entry);
    return entry;
  }

  /**
   * Checks if an identifier is suppressed for a specific merchant.
   */
  async isSuppressed(merchantId: string, rawIdentifier: string, type: SuppressionType): Promise<boolean> {
    const identifier = type === 'PHONE' ? normalizePhone(rawIdentifier) : normalizeEmail(rawIdentifier);
    const key = this.makeKey(merchantId, identifier);
    return this.localCache.has(key);
  }

  /**
   * Removes an identifier from the suppression list.
   */
  async removeSuppression(merchantId: string, rawIdentifier: string, type: SuppressionType): Promise<boolean> {
    const identifier = type === 'PHONE' ? normalizePhone(rawIdentifier) : normalizeEmail(rawIdentifier);
    return this.localCache.delete(this.makeKey(merchantId, identifier));
  }

  /**
   * Retrieves all suppression entries for a merchant.
   */
  async listSuppressions(merchantId: string): Promise<SuppressionEntry[]> {
    const entries: SuppressionEntry[] = [];
    for (const [key, val] of this.localCache.entries()) {
      if (key.startsWith(`${merchantId}:`)) {
        entries.push(val);
      }
    }
    return entries;
  }
}

export const globalSuppressionService = new SuppressionService();
