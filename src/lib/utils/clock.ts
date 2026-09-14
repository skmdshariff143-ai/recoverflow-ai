/**
 * PayBack AI — Clock Abstraction.
 *
 * Eliminates hidden production dependencies on non-deterministic system dates.
 * Enables reproducible simulation and unit testing via FixedClock.
 */

export interface Clock {
  now(): Date;
  nowMs(): number;
  toISOString(): string;
}

export class SystemClock implements Clock {
  now(): Date {
    return new Date();
  }

  nowMs(): number {
    return Date.now();
  }

  toISOString(): string {
    return new Date().toISOString();
  }
}

export class FixedClock implements Clock {
  private currentTime: Date;

  constructor(initialTime: Date | string | number = '2026-03-01T12:00:00.000Z') {
    this.currentTime = new Date(initialTime);
  }

  now(): Date {
    return new Date(this.currentTime.getTime());
  }

  nowMs(): number {
    return this.currentTime.getTime();
  }

  toISOString(): string {
    return this.currentTime.toISOString();
  }

  advanceMs(ms: number): void {
    this.currentTime = new Date(this.currentTime.getTime() + ms);
  }

  advanceMinutes(minutes: number): void {
    this.advanceMs(minutes * 60 * 1000);
  }

  advanceDays(days: number): void {
    this.advanceMs(days * 24 * 60 * 60 * 1000);
  }

  setTime(time: Date | string | number): void {
    this.currentTime = new Date(time);
  }
}

export const defaultClock: Clock = new SystemClock();
