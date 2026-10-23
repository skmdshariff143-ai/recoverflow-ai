import { describe, expect, it } from 'vitest';
import { hostedDemoUrl } from '../../packages/core/src/data/hostedDemo';

describe('Hosted demo database isolation', () => {
  const connection = 'postgresql://sample:example@localhost:5432/postgres?sslmode=require&schema=public';
  it('never uses the demo database in a live, sandbox, or test deployment', () => {
    for (const mode of ['LIVE', 'SANDBOX', 'TEST']) expect(hostedDemoUrl(mode, connection)).toBeNull();
  });
  it('requires an explicit demo connection and pins its isolated schema', () => {
    expect(hostedDemoUrl('DEMO')).toBeNull();
    const url = new URL(hostedDemoUrl('DEMO', connection)!);
    expect(url.searchParams.get('schema')).toBe('recoverflow_demo');
    expect(url.searchParams.get('sslmode')).toBe('require');
    expect(url.searchParams.get('pgbouncer')).toBe('true');
    expect(url.searchParams.get('connection_limit')).toBe('3');
  });
  it('rejects a non-PostgreSQL connection', () => {
    expect(() => hostedDemoUrl('DEMO', 'https://example.test')).toThrow('PostgreSQL');
  });
});
