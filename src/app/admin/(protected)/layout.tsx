'use client';

import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState } from 'react';
import { LayoutDashboard, Users, Mail, Settings, History, ScanLine, BookUser, Upload, LogOut, QrCode, Building2, PlusCircle } from 'lucide-react';
import { signOut } from '@/app/auth/actions';
import { getTenantInfo } from '@/app/actions/dashboard';
import { isSuperAdmin } from '@/app/actions/super-admin';
import './admin.css';

const links = [
  { href: '/admin', label: 'ダッシュボード', icon: LayoutDashboard },
  { href: '/admin?view=participants', label: '参加者・チケット', icon: Users },
  { href: '/admin?view=mail', label: 'メール配信', icon: Mail },
  { href: '/admin/settings', label: 'イベント設定', icon: Settings },
  { href: '/admin?view=history', label: '過去のイベント', icon: History },
  { href: '/admin/staff', label: 'スタッフ・受付端末', icon: ScanLine },
  { href: '/admin/tickets/import', label: 'CSV一括登録', icon: Upload },
  { href: '/admin/master', label: '会員名簿', icon: BookUser },
];

function AdminShell({ children }: { children: React.ReactNode }) {
  const path = usePathname();
  const query = useSearchParams();
  const view = query.get('view');
  const [tenant, setTenant] = useState<{ name: string; company_code: string } | null>(null);
  const [isSuper, setSuper] = useState(false);
  useEffect(() => {
    getTenantInfo().then(setTenant).catch(() => {});
    isSuperAdmin().then(setSuper).catch(() => {});
  }, []);
  const nav = isSuper ? [
    { href: '/admin/super/tenants', label: '企業一覧', icon: Building2 },
    { href: '/admin/super/create-tenant', label: '企業作成', icon: PlusCircle },
  ] : links;
  const current = path === '/admin' && view ? `/admin?view=${view}` : path;
  const title = nav.find(item => item.href === current)?.label || (path.includes('smtp') ? 'メール送信設定' : 'アカウント');
  return <div className="admin-shell">
    <aside className="admin-sidebar">
      <Link href="/admin" className="admin-brand" aria-label="Ticketless ダッシュボード"><span className="admin-brand-icon"><QrCode size={23} /></span>Ticketless</Link>
      <p className="admin-brand-sub">EVENT<br />MANAGEMENT</p>
      <nav className="admin-nav" aria-label="管理メニュー">{nav.map(({href,label,icon: Icon}) => {
        const event = query.get('event');
        const keepsEvent = href === '/admin' || href === '/admin/tickets/import' || href.startsWith('/admin?view=');
        const destination = event && keepsEvent ? `${href}${href.includes('?') ? '&' : '?'}event=${encodeURIComponent(event)}` : href;
        return <Link key={href} href={destination} className={current === href ? 'active' : ''} aria-current={current === href ? 'page' : undefined}><Icon size={16} aria-hidden />{label}</Link>;
      })}</nav>
      <div className="admin-sidebar-foot"><p>イベントの準備から<br />当日の受付まで。</p><p>Ticketless Entry System</p></div>
    </aside>
    <div className="admin-workspace">
      <header className="admin-topbar"><span>イベント管理 / {title}</span><div className="admin-user"><Link href="/admin/account">管理者{tenant ? ` · ${tenant.company_code}` : ''}</Link><form action={signOut}><button aria-label="ログアウト" title="ログアウト"><LogOut size={16} /></button></form></div></header>
      <main className="admin-content">{children}</main>
      <footer className="admin-footer"><span>チケットを、もっとシンプルに。</span><span>{tenant?.name || 'Ticketless'}</span></footer>
    </div>
  </div>;
}
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="p-6">読み込み中…</div>}><AdminShell>{children}</AdminShell></Suspense>;
}
