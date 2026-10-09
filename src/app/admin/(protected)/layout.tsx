import { Suspense } from 'react';
import { redirect } from 'next/navigation';
import { getTenantInfo } from '@/app/actions/dashboard';
import { isSuperAdmin } from '@/app/actions/super-admin';
import AdminShell from './AdminShell';
import './admin.css';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const [tenant, superAdmin] = await Promise.all([getTenantInfo(), isSuperAdmin()]);
  if (superAdmin) redirect('/admin/super/tenants');
  return <Suspense fallback={<p className="p-6">読み込み中…</p>}><AdminShell tenant={tenant}>{children}</AdminShell></Suspense>;
}
