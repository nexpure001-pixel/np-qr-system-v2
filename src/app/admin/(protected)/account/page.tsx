'use client';

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { User, Building2, Key, Mail, Shield } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { getAccountInfo, updatePassword } from "@/app/actions/account";

interface AccountInfo {
    userId: string;
    email?: string;
    createdAt: string;
    lastSignIn?: string;
    tenant?: {
        name: string;
        company_code: string;
        created_at: string;
    } | null;
}

export default function AccountPage() {
    const [accountInfo, setAccountInfo] = useState<AccountInfo | null>(null);
    const [loading, setLoading] = useState(true);
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [updating, setUpdating] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const [loadState, setLoadState] = useState<'login_required' | 'unavailable' | null>(null);
    const loadAccount = useCallback(async () => {
        setLoading(true);
        setLoadState(null);
        try {
            const result = await getAccountInfo();
            if (result.status === 'ready') {
                setAccountInfo(result.account);
            } else {
                setAccountInfo(null);
                setLoadState(result.status);
            }
        } catch {
            setAccountInfo(null);
            setLoadState('unavailable');
        } finally {
            setLoading(false);
        }
    }, []);
    useEffect(() => { void loadAccount(); }, [loadAccount]);

    const handlePasswordUpdate = async (e: React.FormEvent) => {
        e.preventDefault();
        setMessage(null);

        if (newPassword.length < 6) {
            setMessage({ type: 'error', text: 'パスワードは6文字以上で設定してください。' });
            return;
        }

        if (newPassword !== confirmPassword) {
            setMessage({ type: 'error', text: 'パスワードが一致しません。' });
            return;
        }

        setUpdating(true);
        const result = await updatePassword(newPassword);

        if (result.success) {
            setMessage({ type: 'success', text: 'パスワードを更新しました。' });
            setNewPassword('');
            setConfirmPassword('');
        } else {
            setMessage({ type: 'error', text: result.error || '更新に失敗しました。' });
        }

        setUpdating(false);
    };

    if (loading) {
        return <div className="text-center py-8">読み込み中...</div>;
    }

    if (!accountInfo) {
        return <Card className="max-w-xl mx-auto p-6 space-y-4" role="status">
            <h1 className="text-xl font-bold">{loadState === 'login_required' ? '管理者ログインが必要です' : 'アカウント情報を読み込めませんでした'}</h1>
            <p className="text-sm text-foreground/70">{loadState === 'login_required'
                ? 'ログイン状態を確認できませんでした。このシステムの管理者アカウントでログインしてください。'
                : '通信が一時的に不安定な可能性があります。少し待ってから再試行してください。'}</p>
            <div className="flex flex-wrap gap-3">
                {loadState === 'login_required' ? <Link href="/admin/login?next=account" className="admin-button primary">管理者ログインへ</Link> : <Button onClick={loadAccount}>再試行</Button>}
                <Link href="/admin" className="admin-button">ダッシュボードへ戻る</Link>
            </div>
        </Card>;
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <User className="w-6 h-6 text-primary" />
                    アカウント情報
                </h1>
                <p className="text-foreground/70 text-sm mt-1">
                    ログインアカウントと企業情報の確認・変更
                </p>
            </div>

            {/* Account Information */}
            <Card className="p-8">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Mail className="w-5 h-5 text-blue-500" />
                    ログイン情報
                </h2>
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-3 border-b border-border">
                        <span className="text-foreground/60">メールアドレス</span>
                        <span className="font-mono font-bold break-all">{accountInfo.email}</span>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-3 border-b border-border">
                        <span className="text-foreground/60">アカウント作成日</span>
                        <span className="font-bold">{new Date(accountInfo.createdAt).toLocaleString('ja-JP')}</span>
                    </div>
                    {accountInfo.lastSignIn && (
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-3 border-b border-border">
                            <span className="text-foreground/60">最終ログイン</span>
                            <span className="font-bold">{new Date(accountInfo.lastSignIn).toLocaleString('ja-JP')}</span>
                        </div>
                    )}
                </div>
            </Card>

            {/* Company Information */}
            {accountInfo.tenant && (
                <Card className="p-8">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <Building2 className="w-5 h-5 text-green-500" />
                        企業情報
                    </h2>
                    <div className="space-y-4">
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-3 border-b border-border">
                            <span className="text-foreground/60">企業名</span>
                            <span className="font-bold">{accountInfo.tenant.name}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-3 border-b border-border">
                            <span className="text-foreground/60">企業コード</span>
                            <span className="font-mono font-bold text-primary">{accountInfo.tenant.company_code}</span>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-2 py-3 border-b border-border">
                            <span className="text-foreground/60">登録日</span>
                            <span className="font-bold">{new Date(accountInfo.tenant.created_at).toLocaleDateString('ja-JP')}</span>
                        </div>
                    </div>
                </Card>
            )}

            {/* Password Update */}
            <Card className="p-8">
                <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                    <Key className="w-5 h-5 text-orange-500" />
                    パスワード変更
                </h2>
                <form onSubmit={handlePasswordUpdate} className="space-y-6">
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex items-start gap-3">
                        <Shield className="w-5 h-5 text-blue-600 mt-0.5" />
                        <div className="text-sm text-blue-800">
                            <p className="font-bold mb-1">セキュリティのヒント</p>
                            <p>パスワードは6文字以上で、英数字を組み合わせることを推奨します。</p>
                        </div>
                    </div>

                    <Input
                        label="新しいパスワード"
                        type="password"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="6文字以上"
                        required
                    />

                    <Input
                        label="パスワード確認"
                        type="password"
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="もう一度入力"
                        required
                    />

                    {message && (
                        <div className={`p-4 rounded-lg text-sm ${message.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex justify-end">
                        <Button type="submit" disabled={updating}>
                            {updating ? '更新中...' : 'パスワードを更新'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
