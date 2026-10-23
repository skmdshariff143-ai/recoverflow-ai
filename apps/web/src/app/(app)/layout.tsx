import React from 'react';
import { AppShell } from '../../components/app-shell/AppShell';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/server/access';
import { hostedDemo } from '@/lib/server/database';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const session = await readSession(await headers());
  if (!session) redirect('/login');
  return <AppShell session={session} hostedDemo={hostedDemo}>{children}</AppShell>;
}
