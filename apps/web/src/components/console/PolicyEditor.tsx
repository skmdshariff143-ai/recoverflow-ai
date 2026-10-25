'use client';
import { useState } from 'react';
import { Save, ShieldCheck } from 'lucide-react';
import { api, useWorkspace } from './WorkspaceProvider';
import { PageTitle, SourceNote } from './ui';
export function PolicyEditor() {
  const { data, refresh } = useWorkspace();
  const [guidelines, setGuidelines] = useState(data.merchant.guidelines);
  const [discountCeiling, setDiscountCeiling] = useState(data.merchant.discountCeiling);
  const [formality, setFormality] = useState(data.merchant.formality);
  const [urgency, setUrgency] = useState(data.merchant.urgency);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const allowed = ['ADMIN', 'OWNER', 'RECOVERY_MANAGER'].includes(data.session.role);
  async function save(event: React.FormEvent) {
    event.preventDefault(); setBusy(true); setError(''); setNotice('');
    try { await api('/api/console/settings', { method: 'PATCH', body: JSON.stringify({ guidelines, discountCeiling, formality, urgency }) }); await refresh(); setNotice('Merchant policy saved. Your changes are now applied to this workspace.'); }
    catch (err) { setError((err as Error).message); }
    finally { setBusy(false); }
  }
  return <div className="space-y-6"><PageTitle eyebrow="MERCHANT CONTROLS" title="Recovery policy" description="Give your team and advisory tools clear boundaries for customer communication."/><SourceNote source={data.source}/><div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]"><form onSubmit={save} className="rf-panel space-y-6 p-6"><div><label htmlFor="guidelines" className="mb-2 block text-sm font-medium">Brand voice guidelines</label><p className="mb-3 text-xs text-slate-400">Explain how your brand should speak to customers.</p><textarea id="guidelines" className="rf-input min-h-32" value={guidelines} onChange={(event) => setGuidelines(event.target.value)} required minLength={10} maxLength={2000} disabled={!allowed}/></div><div><label htmlFor="discount" className="mb-2 block text-sm font-medium">Maximum discount (%)</label><input id="discount" type="number" className="rf-input max-w-36" min={0} max={50} step={0.5} value={discountCeiling} onChange={(event) => setDiscountCeiling(Number(event.target.value))} required disabled={!allowed}/><p className="mt-2 text-xs text-slate-400">A ceiling is a limit, not authorization to issue a discount.</p></div>{[{ id: 'formality', label: 'Voice formality', value: formality, set: setFormality, left: 'Conversational', right: 'Formal' }, { id: 'urgency', label: 'Message urgency', value: urgency, set: setUrgency, left: 'Gentle', right: 'Direct' }].map((slider) => <div key={slider.id}><label htmlFor={slider.id} className="mb-3 flex justify-between text-sm"><span>{slider.label}</span><span className="font-mono text-slate-400">{Math.round(slider.value * 100)}%</span></label><input id={slider.id} type="range" min={0} max={1} step={0.05} className="w-full accent-emerald-400" value={slider.value} onChange={(event) => slider.set(Number(event.target.value))} disabled={!allowed}/><div className="mt-1 flex justify-between text-xs text-slate-400"><span>{slider.left}</span><span>{slider.right}</span></div></div>)}{error && <p role="alert" className="text-sm text-rose-300">{error}</p>}{notice && <p role="status" className="text-sm text-emerald-300">{notice}</p>}<button className="rf-button" disabled={busy || !allowed}><Save size={15}/>{busy ? 'Saving…' : 'Save policy'}</button>{!allowed && <p className="text-xs text-amber-300">This role has read-only access to merchant policies.</p>}</form><aside className="rf-panel h-fit p-6"><ShieldCheck size={24} className="text-emerald-400"/><h2 className="mt-4 text-lg font-medium">Guardrails stay in control.</h2><p className="mt-3 text-sm leading-relaxed text-slate-400">Advisory text cannot authorize a financial transaction. High-value reviews require two distinct operators.</p><dl className="mt-6 divide-y divide-slate-800 text-xs"><div className="flex justify-between py-3"><dt className="text-slate-400">Configured margin floor</dt><dd>{data.merchant.minMargin}%</dd></div><div className="flex justify-between py-3"><dt className="text-slate-400">Policy access</dt><dd>{allowed ? 'Can edit' : 'Read only'}</dd></div><div className="flex justify-between py-3"><dt className="text-slate-400">Data persistence</dt><dd>{data.source === 'DEMO' ? 'Until server restart' : 'PostgreSQL'}</dd></div></dl></aside></div></div>;
}

