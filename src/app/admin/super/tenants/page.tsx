'use client';

import { deleteTenant, getAllTenants } from "@/app/actions/super-admin";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Loader2, Trash2, Building2, User } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";

interface Tenant {
    id: string;
    name: string;
    company_code: string;
    email: string;
    created_at: string;
}

export default function TenantsPage() {
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    const loadTenants = useCallback(async () => {
        const data = await getAllTenants();
        setTenants(data as Tenant[]);
        setLoading(false);
    }, []);

    useEffect(() => {
        let isMounted = true;
        const init = async () => {
            const data = await getAllTenants();
            if (isMounted) {
                setTenants(data as Tenant[]);
                setLoading(false);
            }
        };
        init();
        return () => { isMounted = false; };
    }, []);

    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`本当にテナント「${name}」を削除しますか？\nこの操作は取り消せません。\n紐づく全てのイベント、名簿、参加者が削除されます。`)) {
            return;
        }

        setDeletingId(id);
        const result = await deleteTenant(id);

        if (result.success) {
            if (result.warning) alert(result.warning);
            loadTenants();
        } else {
            alert(result.error);
        }
        setDeletingId(null);
    };

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">テナント管理</h1>
                    <p className="text-gray-500">システムに登録されている全企業の一覧です。</p>
                </div>
                <Link href="/admin/super/create-tenant">
                    <Button>新規テナント作成</Button>
                </Link>
            </div>

            <Card className="overflow-hidden bg-white shadow-sm border border-gray-200">
                <div className="overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="bg-gray-50 text-gray-500 uppercase font-medium border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4">企業名 / コード</th>
                                <th className="px-6 py-4">管理者 (メール)</th>
                                <th className="px-6 py-4">作成日</th>
                                <th className="px-6 py-4 text-center">アクション</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2" />
                                        読み込み中...
                                    </td>
                                </tr>
                            ) : tenants.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-6 py-12 text-center text-gray-500">
                                        テナントがありません。
                                    </td>
                                </tr>
                            ) : (
                                tenants.map((tenant) => (
                                    <tr key={tenant.id} className="hover:bg-gray-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-3">
                                                <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
                                                    <Building2 className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-bold text-gray-900 text-base">{tenant.name}</div>
                                                    <div className="font-mono text-gray-400 text-xs">{tenant.company_code}</div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <User className="w-4 h-4 text-gray-400" />
                                                {tenant.email}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-gray-500">
                                            {new Date(tenant.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700 border-red-100"
                                                onClick={() => handleDelete(tenant.id, tenant.name)}
                                                disabled={deletingId === tenant.id}
                                            >
                                                {deletingId === tenant.id ? (
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                ) : (
                                                    <Trash2 className="w-4 h-4" />
                                                )}
                                                <span className="ml-2">削除</span>
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
