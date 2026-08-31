/**
 * PayBack AI — Unit tests for fuzzyMatch utility.
 */

import { describe, test, expect } from 'vitest';
import { fuzzyMatch, filterCommands, type CommandItem } from '@/lib/utils/fuzzyMatch';

describe('fuzzyMatch', () => {
  test('empty query matches everything with score 1', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ matches: true, score: 1 });
    expect(fuzzyMatch('', '')).toEqual({ matches: true, score: 1 });
  });

  test('exact substring match returns high score', () => {
    const result = fuzzyMatch('pay_00', 'pay_00042');
    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThan(100);
  });

  test('prefix match scores higher than mid-string match', () => {
    const prefix = fuzzyMatch('pay', 'pay_00042');
    const mid = fuzzyMatch('004', 'pay_00042');
    expect(prefix.matches).toBe(true);
    expect(mid.matches).toBe(true);
    expect(prefix.score).toBeGreaterThan(mid.score);
  });

  test('subsequence match works for non-contiguous characters', () => {
    const result = fuzzyMatch('pab', 'PayBack');
    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });

  test('non-matching query returns no match', () => {
    const result = fuzzyMatch('xyz123', 'PayBack AI');
    expect(result.matches).toBe(false);
    expect(result.score).toBe(0);
  });

  test('case-insensitive matching', () => {
    const result = fuzzyMatch('PAYBACK', 'payback ai');
    expect(result.matches).toBe(true);
    expect(result.score).toBeGreaterThan(0);
  });
});

describe('filterCommands', () => {
  const commands: CommandItem[] = [
    { id: 'nav-dashboard', label: 'Command Center', keywords: ['dashboard', 'queue'], category: 'navigation' },
    { id: 'nav-eval', label: 'Evaluation Lab', keywords: ['evaluation', 'simulator'], category: 'navigation' },
    { id: 'pay-001', label: 'pay_00001', keywords: ['pay_00001', 'cust_0042'], category: 'payment' },
    { id: 'pay-002', label: 'pay_00002', keywords: ['pay_00002', 'cust_0017'], category: 'payment' },
    { id: 'act-resim', label: 'Re-Simulate Batch', keywords: ['resimulate', 'batch', 'seed'], category: 'action' },
    { id: 'act-ledger', label: 'Verify Ledger Integrity', keywords: ['verify', 'ledger', 'hash'], category: 'action' },
  ];

  test('empty query returns all commands', () => {
    const results = filterCommands(commands, '');
    expect(results).toHaveLength(commands.length);
  });

  test('filters by payment_id substring', () => {
    const results = filterCommands(commands, 'pay_0000');
    expect(results.length).toBeGreaterThanOrEqual(2);
    expect(results.every((r) => r.category === 'payment')).toBe(true);
  });

  test('filters by keyword match', () => {
    const results = filterCommands(commands, 'ledger');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('act-ledger');
  });

  test('results are sorted by score descending', () => {
    const results = filterCommands(commands, 'eval');
    for (let i = 1; i < results.length; i++) {
      expect(results[i - 1].score).toBeGreaterThanOrEqual(results[i].score);
    }
  });

  test('no results for non-matching query', () => {
    const results = filterCommands(commands, 'zzzzzz');
    expect(results).toHaveLength(0);
  });

  test('matches against label even if keyword does not match', () => {
    const results = filterCommands(commands, 'Command Center');
    expect(results.length).toBeGreaterThanOrEqual(1);
    expect(results[0].id).toBe('nav-dashboard');
  });
});
