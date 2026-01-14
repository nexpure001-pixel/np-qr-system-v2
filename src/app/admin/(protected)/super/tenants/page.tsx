'use client';

import { Card } from "@/components/ui/Card";
import { Building2, Mail, Hash, Calendar, Trash2, AlertTriangle } from "lucide-react";
import { useEffect, useState } from "react";
import { getAllTenants, deleteTenant } from "@/app/actions/super-admin";
import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function TenantsListPage() {
    const [tenants, setTenants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [deleteModal, setDeleteModal] = useState<{ show: boolean, tenant: any | null }>({ show: false, tenant: null });
    const [deleting, setDeleting] = useState(false);

    const loadTenants = () => {
        getAllTenants().then(data => {
            setTenants(data);
            setLoading(false);
        });
    };

    useEffect(() => {
        loadTenants();
    }, []);

    const handleDeleteClick = (tenant: any) => {
        setDeleteModal({ show: true, tenant });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModal.tenant) return;

        setDeleting(true);
        const result = await deleteTenant(deleteModal.tenant.id);

        if (result.success) {
            alert('企業を削除しました。');
            setDeleteModal({ show: false, tenant: null });
            loadTenants(); // Reload list
        } else {
            alert('削除に失敗しました: ' + result.error);
        }

        setDeleting(false);
    };

    if (loading) {
        return <div className="text-center py-8">読み込み中...</div>;
    }

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <Building2 className="w-6 h-6 text-primary" />
                        登録企業一覧
                    </h1>
                    <p className="text-foreground/70 text-sm mt-1">
                        システムに登録されている全企業の情報
                    </p>
                </div>
                <Link href="/admin/super/create-tenant">
                    <Button>
                        新規企業作成
                    </Button>
                </Link>
            </div>

            <Card className="p-0 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-foreground/70 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">企業名</th>
                                <th className="px-6 py-4">企業コード</th>
                                <th className="px-6 py-4">登録メールアドレス</th>
                                <th className="px-6 py-4">登録日</th>
                                <th className="px-6 py-4 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {tenants.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="p-8 text-center text-foreground/50">
                                        登録企業がありません
                                    </td>
                                </tr>
                            ) : (
                                tenants.map(tenant => (
                                    <tr key={tenant.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-4 font-bold">
                                            {tenant.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="font-mono font-bold text-primary">
                                                {tenant.company_code}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-foreground/40" />
                                                <span className="font-mono">{tenant.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-foreground/60">
                                            {new Date(tenant.created_at).toLocaleDateString('ja-JP')}
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleDeleteClick(tenant)}
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </Card>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm text-blue-800">
                    <strong>📊 統計</strong><br />
                    登録企業数: <span className="font-bold">{tenants.length}</span> 社
                </p>
            </div>

            {/* Delete Confirmation Modal */}
            {deleteModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                            <h2 className="text-xl font-bold text-red-600">企業削除の確認</h2>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <p className="text-sm text-red-800 font-bold mb-2">
                                ⚠️ この操作は取り消せません
                            </p>
                            <p className="text-sm text-red-700">
                                以下の企業とすべての関連データが完全に削除されます：
                            </p>
                            <ul className="text-sm text-red-700 mt-2 ml-4 list-disc">
                                <li>企業情報</li>
                                <li>ログインアカウント</li>
                                <li>イベント</li>
                                <li>名簿データ</li>
                                <li>参加者データ</li>
                                <li>メール送信履歴</li>
                            </ul>
                        </div>

                        <div className="bg-gray-100 rounded-lg p-4 mb-6">
                            <p className="text-sm text-foreground/60 mb-1">削除対象企業</p>
                            <p className="font-bold text-lg">{deleteModal.tenant?.name}</p>
                            <p className="text-sm text-foreground/60 mt-1">
                                企業コード: <span className="font-mono font-bold">{deleteModal.tenant?.company_code}</span>
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setDeleteModal({ show: false, tenant: null })}
                                disabled={deleting}
                                className="flex-1"
                            >
                                キャンセル
                            </Button>
                            <Button
                                onClick={handleDeleteConfirm}
                                disabled={deleting}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                                {deleting ? '削除中...' : '削除する'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
