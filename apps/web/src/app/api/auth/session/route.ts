import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/server/database';
import { createSessionToken, verifySessionToken, DEMO_PERSONA_SESSIONS, extractTokenFromHeaders, hashSessionToken } from '@recoverflow/core';
import { getRuntimeMode } from '@recoverflow/core';
import { verifyPassword } from '@recoverflow/core';
import { route, ApiError, readSession } from '@/lib/server/access';
import { limitLogin } from '@/lib/server/login-limit';

const schema = z.discriminatedUnion('method', [
  z.object({ method: z.literal('demo'), role: z.enum(['OWNER', 'ADMIN', 'RECOVERY_MANAGER', 'ANALYST', 'VIEWER', 'DEVELOPER', 'SUPPORT_AGENT']).default('ADMIN') }),
  z.object({ method: z.literal('password'), email: z.email().max(254), password: z.string().min(1).max(256), organization: z.string().min(1).max(100) }),
]);

export const GET = route(async (request) => {
  return NextResponse.json({ mode: getRuntimeMode(), session: await readSession(request.headers) });
});

export const POST = route(async (request) => {
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) throw new ApiError(400, 'Enter a valid email, password, and workspace.');
  const input = parsed.data;
  const mode = getRuntimeMode();
  let identity;
  if (input.method === 'demo') {
    if (mode !== 'DEMO' && mode !== 'TEST') throw new ApiError(403, 'Demo sign-in is disabled on this installation.');
    identity = DEMO_PERSONA_SESSIONS[input.role];
  } else {
    await limitLogin(input.email);
    const user = await db.getUserByEmail(input.email.trim().toLowerCase());
    const passwordValid = await verifyPassword(input.password, user?.passwordHash);
    const organization = await db.getOrganizationBySlug(input.organization.trim().toLowerCase());
    const membership = user && organization ? await db.getMembership(user.id, organization.id) : null;
    if (!user || !organization || !membership || !passwordValid) throw new ApiError(401, 'The credentials or workspace are incorrect.');
    const merchants = await db.listMerchants(organization.id);
    const merchant = merchants.find((entry) => entry.organizationId === organization.id);
    if (!merchant) throw new ApiError(403, 'This workspace has no assigned merchant. Contact your administrator.');
    identity = { userId: user.id, name: user.name || user.email, email: user.email, organizationId: organization.id, organizationSlug: organization.slug, activeMerchantId: merchant.id, role: membership.role };
  }
  const token = createSessionToken({ ...identity, runtimeMode: mode }, 8 * 60 * 60 * 1000);
  const { session } = verifySessionToken(token);
  if (!session) throw new ApiError(503, 'Unable to create session.');
  await db.createSession({ userId: session.userId, tokenHash: hashSessionToken(token), organizationId: session.organizationId, activeMerchantId: session.activeMerchantId, role: session.role, expiresAt: new Date(session.expiresAt) });
  // Rotate and revoke the previous session when changing demo roles or signing in again.
  const previous = extractTokenFromHeaders(request.headers);
  if (previous) {
    const record = await db.getSession(hashSessionToken(previous));
    if (record) await db.revokeSession(record.id, 'Session rotated');
  }
  const response = NextResponse.json({ mode, session });
  response.cookies.set('recoverflow_session', token, { httpOnly: true, secure: new URL(process.env.APP_URL || request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 8 * 60 * 60 });
  return response;
});

export const DELETE = route(async (request) => {
  const token = extractTokenFromHeaders(request.headers);
  if (token) {
    const record = await db.getSession(hashSessionToken(token));
    if (record) await db.revokeSession(record.id, 'User signed out');
  }
  const response = NextResponse.json({ success: true });
  response.cookies.set('recoverflow_session', '', { httpOnly: true, secure: new URL(process.env.APP_URL || request.url).protocol === 'https:', sameSite: 'lax', path: '/', maxAge: 0 });
  return response;
});
