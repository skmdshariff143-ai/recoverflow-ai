'use client';
import { createElement } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Activity, ArrowUpRight, BarChart3, Bot, Code2, FileCheck2, FlaskConical, LayoutDashboard, ListOrdered, MessageSquare, Settings, ShieldCheck, Sliders, Users, Workflow, Zap, CreditCard, ShoppingCart, Repeat, Handshake } from 'lucide-react';

export const navigation = [
  { group: 'WORKSPACE', items: [
    { label: 'Overview', href: '/overview', icon: LayoutDashboard },
    { label: 'Recovery queue', href: '/recovery/queue', icon: ListOrdered },
    { label: 'All cases', href: '/recovery/cases', icon: FileCheck2 },
    { label: 'Approvals', href: '/recovery/approvals', icon: ShieldCheck },
    { label: 'Customers', href: '/customers', icon: Users },
  ] },
  { group: 'INSIGHTS', items: [
    { label: 'Analytics', href: '/analytics', icon: BarChart3 },
    { label: 'Copilot', href: '/intelligence/copilot', icon: Bot },
    { label: 'Communications', href: '/communications', icon: MessageSquare },
    { label: 'Audit ledger', href: '/audit', icon: Workflow },
  ] },
  { group: 'COMMERCE & LABS', items: [
    { label: 'Carts', href: '/commerce/carts', icon: ShoppingCart },
    { label: 'Payments', href: '/commerce/payments', icon: CreditCard },
    { label: 'Subscriptions', href: '/commerce/subscriptions', icon: Repeat },
    { label: 'Promises', href: '/recovery/promises', icon: Handshake },
    { label: 'Experiments', href: '/intelligence/experiments', icon: FlaskConical },
    { label: 'Model lab', href: '/intelligence/model-lab', icon: Activity },
  ] },
  { group: 'MANAGE', items: [
    { label: 'Policies', href: '/policies', icon: Sliders },
    { label: 'Integrations', href: '/integrations', icon: Zap },
    { label: 'Operations', href: '/operations', icon: Activity },
    { label: 'Developers', href: '/developers', icon: Code2 },
    { label: 'Team', href: '/team', icon: Users },
    { label: 'Settings', href: '/settings', icon: Settings },
  ] },
];
export function AppSidebar({ onNavigate, demo = true }: { onNavigate?: () => void; demo?: boolean }) {
  const pathname = usePathname();
  return <aside className="flex h-full w-60 flex-col border-r border-slate-800/80 bg-[#080b10]">
    <Link href="/" className="flex h-20 shrink-0 items-center gap-3 px-6" aria-label="RecoverFlow AI home"><span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500 text-slate-950 shadow-[0_0_15px_rgba(16,185,129,0.3)]"><Workflow size={22}/></span><span className="text-[15px] font-semibold tracking-tight text-white">RecoverFlow<span className="ml-1 text-emerald-400">AI</span></span></Link>
    <nav aria-label="Workspace navigation" className="flex-1 space-y-6 overflow-y-auto px-3 pb-6">{navigation.map((group) => <div key={group.group}><p className="mb-2 px-3 text-[9px] font-semibold tracking-[.16em] text-slate-400">{group.group}</p><ul className="space-y-0.5">{group.items.map((item) => { const active = pathname === item.href || pathname.startsWith(item.href + '/'); return <li key={item.href}><Link href={item.href} onClick={onNavigate} aria-current={active ? 'page' : undefined} className={`flex min-h-9 items-center gap-3 rounded-lg px-3 py-2 text-xs font-medium transition-colors ${active ? 'bg-emerald-400/10 text-emerald-300 font-semibold' : 'text-slate-400 hover:bg-slate-800/60 hover:text-white'}`}>{createElement(item.icon, { size: 15 })}{item.label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_8px_#10b981]"/>}</Link></li>; })}</ul></div>)}</nav>
    <div className="shrink-0 border-t border-slate-800 p-4">{demo ? <Link href="/demo" className="flex items-center justify-between rounded-xl border border-slate-800 bg-[#0f172a] p-3 text-xs text-slate-300 hover:border-slate-700 transition-colors">Explore benchmark lab<ArrowUpRight size={14}/></Link> : <p className="text-xs text-slate-400">Your merchant workspace<br/><span className="text-slate-400">Provider activation managed by your administrator.</span></p>}</div>
  </aside>;
}

