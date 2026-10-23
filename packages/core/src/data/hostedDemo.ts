// A dedicated connection is required. Never fall back to the live DATABASE_URL.
export function hostedDemoUrl(mode: string, connection?: string): string | null {
  if (mode !== 'DEMO' || !connection) return null;
  const url = new URL(connection);
  if (!['postgres:', 'postgresql:'].includes(url.protocol)) throw new Error('Hosted demo requires PostgreSQL.');
  url.searchParams.set('schema', 'recoverflow_demo');
  url.searchParams.set('connection_limit', '3');
  url.searchParams.set('pgbouncer', 'true');
  return url.toString();
}
