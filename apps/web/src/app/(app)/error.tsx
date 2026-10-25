'use client';
import Link from 'next/link';
export default function WorkspaceError({ reset }: { reset: () => void }) {
  return <div className="rf-panel m-6 p-8" role="alert"><h1 className="text-2xl font-semibold">We couldn’t load this workspace</h1><p className="my-4 text-slate-400">Check the database connection and workspace configuration, then try again.</p><div className="flex gap-4"><button className="rf-button" onClick={reset}>Try again</button><Link className="rf-button-secondary" href="/login">Return to sign in</Link></div></div>;
}
