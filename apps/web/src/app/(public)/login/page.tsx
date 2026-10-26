import type { Metadata } from 'next';
import { headers } from 'next/headers';
import { redirect } from 'next/navigation';
import { readSession } from '@/lib/server/access';
import { LoginForm } from '@/components/console/LoginForm';
import { getRuntimeMode } from '@recoverflow/core';

export const metadata: Metadata = {
  title: 'Sign In',
  description: 'Sign in to the RecoverFlow AI merchant recovery console or explore the instant demo workspace.',
  robots: {
    index: false,
    follow: true,
  },
};

export default async function LoginPage() {
  if (await readSession(await headers())) redirect('/overview');
  return <LoginForm mode={getRuntimeMode()} />;
}
