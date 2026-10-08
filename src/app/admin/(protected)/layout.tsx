'use client';

import Link from "next/link";
import { LogOut, List, PlusCircle, BarChart, Building2 } from "lucide-react";
import { signOut } from "@/app/auth/actions";
import { useEffect, useState } from "react";
import { getTenantInfo } from "@/app/actions/dashboard";
import { isSuperAdmin } from "@/app/actions/super-admin";

interface TenantInfo {
    name: string;
    company_code: string;
}

export default function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const [tenantInfo, setTenantInfo] = useState<TenantInfo | null>(null);
    const [isSuper, setIsSuper] = useState(false);

    useEffect(() => {
        getTenantInfo().then(data => {
            setTenantInfo(data);
        });
        isSuperAdmin().then(result => {
            setIsSuper(result);
        });
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-secondary/50">
            {/* Admin Header */}
            <header className="bg-white border-b border-border sticky top-0 z-10">
                <div className="container mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-3 sm:px-6">
                    <Link href="/admin" className="text-xl font-bold text-primary tracking-wide">
                        {isSuper ? '企業管理画面' : 'チケットレス管理'}
                    </Link>

                    {isSuper ? (
                        // Super Admin Navigation
                        <nav className="order-last flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-sm font-medium text-foreground/70">
                            <Link href="/admin/super/tenants" className="hover:text-primary flex items-center gap-2 min-h-11 transition-colors">
                                <List className="w-4 h-4" />
                                企業一覧
                            </Link>
                            <Link href="/admin/super/create-tenant" className="text-foreground/70 hover:text-primary inline-flex min-h-11 items-center transition-colors">
                                <PlusCircle className="w-4 h-4 inline mr-1" />
                                企業作成
                            </Link>
                        </nav>
                    ) : (
                        // Regular Admin Navigation
                        <nav className="order-last flex w-full flex-wrap items-center gap-x-5 gap-y-2 border-t border-slate-100 pt-3 text-sm font-medium text-foreground/70">
                            <Link href="/admin" className="hover:text-primary flex items-center gap-2 min-h-11 transition-colors">
                                <BarChart className="w-4 h-4" />
                                ダッシュボード
                            </Link>
                            <Link href="/admin/master" className="text-foreground/70 hover:text-primary inline-flex min-h-11 items-center transition-colors">
                                名簿管理(Master)
                            </Link>
                            <Link href="/admin/settings" className="text-foreground/70 hover:text-primary inline-flex min-h-11 items-center transition-colors">
                                イベント設定
                            </Link>
                            <Link href="/admin/tickets/import" className="text-foreground/70 hover:text-primary inline-flex min-h-11 items-center transition-colors">
                                チケット一括登録
                            </Link>
                            <Link href="/admin/settings/smtp" className="text-foreground/70 hover:text-primary inline-flex min-h-11 items-center transition-colors">
                                SMTP設定
                            </Link>
                            <Link href="/admin/account" className="text-foreground/70 hover:text-primary inline-flex min-h-11 items-center transition-colors">
                                アカウント
                            </Link>
                        </nav>
                    )}

                    <div className="flex items-center gap-4">
                        {!isSuper && tenantInfo && (
                            <div className="hidden md:flex items-center gap-2 px-3 py-2 bg-blue-50 border border-blue-200 rounded-lg">
                                <Building2 className="w-4 h-4 text-blue-600" />
                                <span className="text-xs font-bold text-blue-700">
                                    企業コード: <span className="font-mono">{tenantInfo.company_code}</span>
                                </span>
                            </div>
                        )}
                        <form action={signOut}>
                            <button type="submit" className="text-sm font-bold text-red-500 hover:bg-red-50 px-3 py-2 rounded-md transition-colors flex items-center gap-2">
                                <LogOut className="w-4 h-4" />
                                ログアウト
                            </button>
                        </form>
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 min-w-0 container mx-auto px-4 py-6 sm:px-6 sm:py-8">
                {children}
            </main>
        </div>
    );
}
