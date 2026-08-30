/**
 * RecoverFlow AI — Quiet-Hours Scheduler.
 *
 * Ensures customer communication respects timezone-specific quiet hours.
 * Uses native Intl.DateTimeFormat for accurate timezone conversion
 * without external dependencies.
 */

import type { QuietHoursWindow } from '@/types';

/**
 * Get the local hour and date parts for a given Date in a specific IANA timezone.
 */
export function getLocalTimeParts(
  date: Date,
  timezone: string,
): { year: number; month: number; day: number; hour: number; minute: number } {
  const formatter = new Intl.DateTimeFormat('en-US', {
    timeZone: timezone,
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: 'numeric',
    minute: 'numeric',
    hourCycle: 'h23',
  });

  const parts = formatter.formatToParts(date);
  const findPart = (type: string): number => {
    const p = parts.find((pt) => pt.type === type);
    return p ? parseInt(p.value, 10) : 0;
  };

  return {
    year: findPart('year'),
    month: findPart('month'),
    day: findPart('day'),
    hour: findPart('hour'),
    minute: findPart('minute'),
  };
}

/**
 * Determine whether a given timestamp falls within the customer's quiet hours.
 */
export function isInsideQuietHours(
  date: Date,
  window: QuietHoursWindow,
): boolean {
  try {
    const { hour } = getLocalTimeParts(date, window.timezone);
    const { start, end } = window;

    if (start === end) {
      return false; // No quiet hours configured if start equals end
    }

    if (start < end) {
      // Single-day window (e.g., 13:00 to 16:00)
      return hour >= start && hour < end;
    } else {
      // Overnight window (e.g., 22:00 to 07:00)
      return hour >= start || hour < end;
    }
  } catch {
    // Fallback if timezone string is invalid: evaluate against UTC
    const hour = date.getUTCHours();
    const { start, end } = window;
    if (start < end) {
      return hour >= start && hour < end;
    } else {
      return hour >= start || hour < end;
    }
  }
}

/**
 * Calculate the next allowed contact time for a customer.
 *
 * If the current time is outside quiet hours, returns the current time.
 * If inside quiet hours, advances the timestamp until the quiet window ends
 * in the customer's timezone.
 */
export function calculateNextContactTime(
  currentDate: Date,
  window: QuietHoursWindow,
): Date {
  if (!isInsideQuietHours(currentDate, window)) {
    return new Date(currentDate.getTime());
  }

  // Iterate forward in 15-minute intervals up to 24 hours to find the first valid non-quiet slot
  const stepMs = 15 * 60 * 1000;
  let candidate = new Date(currentDate.getTime() + stepMs);
  const maxSearchTime = currentDate.getTime() + 25 * 60 * 60 * 1000;

  while (candidate.getTime() <= maxSearchTime) {
    if (!isInsideQuietHours(candidate, window)) {
      return candidate;
    }
    candidate = new Date(candidate.getTime() + stepMs);
  }

  // Fallback: advance 8 hours
  return new Date(currentDate.getTime() + 8 * 60 * 60 * 1000);
}
