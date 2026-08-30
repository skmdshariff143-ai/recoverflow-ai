/**
 * Unit tests for the RecoverFlow AI Quiet-Hours Scheduler.
 *
 * Validates:
 *  1. Accurate detection of timestamps inside/outside quiet hours across timezones.
 *  2. Overnight windows (e.g. 22:00–07:00) vs daytime windows (e.g. 13:00–15:00).
 *  3. calculateNextContactTime ALWAYS computes a timestamp strictly outside quiet hours.
 *  4. Non-quiet timestamps are dispatched immediately without unnecessary deferral.
 */

import { describe, it, expect } from 'vitest';
import {
  isInsideQuietHours,
  calculateNextContactTime,
  getLocalTimeParts,
} from '../quietHours';
import type { QuietHoursWindow } from '@/types';

describe('quietHours', () => {

  // ── 1. getLocalTimeParts ────────────────────────────────────────

  it('correctly parses time components in Asia/Kolkata (UTC+5:30)', () => {
    // 2025-08-30T10:00:00Z -> 15:30 in Asia/Kolkata
    const date = new Date('2025-08-30T10:00:00Z');
    const parts = getLocalTimeParts(date, 'Asia/Kolkata');
    expect(parts.hour).toBe(15);
    expect(parts.minute).toBe(30);
  });

  it('correctly parses time components in America/New_York (UTC-4 in August EDT)', () => {
    // 2025-08-30T10:00:00Z -> 06:00 EDT
    const date = new Date('2025-08-30T10:00:00Z');
    const parts = getLocalTimeParts(date, 'America/New_York');
    expect(parts.hour).toBe(6);
    expect(parts.minute).toBe(0);
  });

  // ── 2. isInsideQuietHours ───────────────────────────────────────

  it('detects overnight quiet hours (e.g. 22:00 to 07:00)', () => {
    const window: QuietHoursWindow = {
      start: 22,
      end: 7,
      timezone: 'Asia/Kolkata',
    };

    // 23:30 IST (18:00 UTC) -> inside quiet hours
    const night = new Date('2025-08-30T18:00:00Z');
    expect(isInsideQuietHours(night, window)).toBe(true);

    // 04:30 IST (23:00 UTC previous day) -> inside quiet hours
    const earlyMorning = new Date('2025-08-29T23:00:00Z');
    expect(isInsideQuietHours(earlyMorning, window)).toBe(true);

    // 14:30 IST (09:00 UTC) -> outside quiet hours
    const afternoon = new Date('2025-08-30T09:00:00Z');
    expect(isInsideQuietHours(afternoon, window)).toBe(false);
  });

  it('detects single-day quiet hours (e.g. 13:00 to 16:00)', () => {
    const window: QuietHoursWindow = {
      start: 13,
      end: 16,
      timezone: 'Europe/London',
    };

    // 14:00 BST (13:00 UTC in August) -> inside
    const inside = new Date('2025-08-30T13:00:00Z');
    expect(isInsideQuietHours(inside, window)).toBe(true);

    // 10:00 BST (09:00 UTC) -> outside
    const outside = new Date('2025-08-30T09:00:00Z');
    expect(isInsideQuietHours(outside, window)).toBe(false);
  });

  // ── 3. calculateNextContactTime ─────────────────────────────────

  it('leaves timestamp unchanged when currently outside quiet hours', () => {
    const window: QuietHoursWindow = {
      start: 22,
      end: 7,
      timezone: 'Asia/Kolkata',
    };
    const midday = new Date('2025-08-30T08:30:00Z'); // 14:00 IST
    const nextTime = calculateNextContactTime(midday, window);

    expect(nextTime.getTime()).toBe(midday.getTime());
  });

  it('calculates a timestamp that is GUARANTEED to be outside quiet hours (property test)', () => {
    const windows: QuietHoursWindow[] = [
      { start: 22, end: 7, timezone: 'Asia/Kolkata' },
      { start: 21, end: 8, timezone: 'America/New_York' },
      { start: 23, end: 6, timezone: 'Europe/London' },
      { start: 13, end: 16, timezone: 'Asia/Tokyo' },
    ];

    // Test across every hour of a 24-hour cycle
    const base = new Date('2025-08-30T00:00:00Z');

    for (const win of windows) {
      for (let h = 0; h < 24; h++) {
        const testDate = new Date(base.getTime() + h * 3600 * 1000);
        const scheduledTime = calculateNextContactTime(testDate, win);

        // Core safety invariant: scheduled contact time is NEVER inside quiet hours
        expect(
          isInsideQuietHours(scheduledTime, win),
          `Scheduled time ${scheduledTime.toISOString()} fell inside quiet hours for timezone ${win.timezone}`,
        ).toBe(false);

        // Scheduled time is never in the past
        expect(scheduledTime.getTime()).toBeGreaterThanOrEqual(testDate.getTime());
      }
    }
  });
});
