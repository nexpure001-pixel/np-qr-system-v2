'use client';

import { isSuperAdmin } from "@/app/actions/super-admin";
import { Loader2, LayoutDashboard, PlusCircle, LogOut } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { signOut } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";

export default function SuperAdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const router = useRouter();
    const [checking, setChecking] = useState(true);

    useEffect(() => {
        isSuperAdmin().then(isAdmin => {
            if (!isAdmin) {
                router.push('/admin/login');
            } else {
                setChecking(false);
            }
        });
    }, [router]);

    if (checking) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50">
            {/* Header */}
            <header className="bg-slate-900 text-white shadow-md">
                <div className="container mx-auto px-4 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-8">
                        <Link href="/admin/super/tenants" className="font-bold text-xl tracking-tight text-white/90 hover:text-white">
                            🎫 Ticketless Super Admin
                        </Link>

                        <nav className="hidden md:flex gap-1">
                            <Link
                                href="/admin/super/tenants"
                                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/10 transition-colors text-sm font-medium"
                            >
                                <LayoutDashboard className="w-4 h-4" />
                                テナント一覧
                            </Link>
                            <Link
                                href="/admin/super/create-tenant"
                                className="flex items-center gap-2 px-3 py-2 rounded-md hover:bg-white/10 transition-colors text-sm font-medium"
                            >
                                <PlusCircle className="w-4 h-4" />
                                テナント作成
                            </Link>
                        </nav>
                    </div>

                    <form action={signOut}>
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-white/70 hover:text-white hover:bg-white/10"
                        >
                            <LogOut className="w-4 h-4 mr-2" />
                            ログアウト
                        </Button>
                    </form>
                </div>
            </header>

            {/* Main Content */}
            <main className="container mx-auto px-4 py-8">
                {children}
            </main>
        </div>
    );
}
