'use client';

import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Building2, Mail, Key, Hash, Shield, CheckCircle, Copy } from "lucide-react";
import { useEffect, useState } from "react";
import { createTenantAccount, autoGenerateCompanyCode, isSuperAdmin } from "@/app/actions/super-admin";

export default function CreateTenantPage() {
    const [isAdmin, setIsAdmin] = useState(false);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [companyCode, setCompanyCode] = useState('');
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
    const [credentials, setCredentials] = useState<any>(null);

    useEffect(() => {
        isSuperAdmin().then(result => {
            setIsAdmin(result);
            setLoading(false);
        });
    }, []);

    const handleGenerateCode = async () => {
        const code = await autoGenerateCompanyCode();
        setCompanyCode(code);
    };

    const handleSubmit = async (formData: FormData) => {
        setSubmitting(true);
        setMessage(null);
        setCredentials(null);

        const result = await createTenantAccount(formData);

        if (result.success) {
            setMessage({ type: 'success', text: '企業アカウントを作成しました。' });
            setCredentials(result.credentials);
            // Reset form
            (document.getElementById('create-tenant-form') as HTMLFormElement)?.reset();
            setCompanyCode('');
        } else {
            setMessage({ type: 'error', text: result.error || '作成に失敗しました。' });
        }

        setSubmitting(false);
    };

    if (loading) {
        return <div className="text-center py-8">読み込み中...</div>;
    }

    if (!isAdmin) {
        return (
            <div className="max-w-2xl mx-auto mt-20">
                <Card className="p-8 text-center">
                    <Shield className="w-16 h-16 mx-auto text-red-500 mb-4" />
                    <h1 className="text-2xl font-bold text-red-600 mb-2">アクセス拒否</h1>
                    <p className="text-foreground/60">このページにアクセスする権限がありません。</p>
                </Card>
            </div>
        );
    }

    return (
        <div className="max-w-4xl mx-auto space-y-8">
            <div>
                <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                    <Shield className="w-6 h-6 text-primary" />
                    企業アカウント作成（スーパー管理者）
                </h1>
                <p className="text-foreground/70 text-sm mt-1">
                    新規企業のアカウントを作成します
                </p>
            </div>

            {/* Success Display */}
            {credentials && (
                <Card className="p-8 border-4 border-green-500 bg-green-50">
                    <div className="flex items-center gap-3 mb-6">
                        <CheckCircle className="w-8 h-8 text-green-600" />
                        <h2 className="text-xl font-bold text-green-800">アカウント作成完了</h2>
                    </div>

                    <div className="bg-white rounded-lg p-6 space-y-4">
                        <div className="flex justify-between items-center py-3 border-b">
                            <span className="text-foreground/60">企業コード</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-lg">{credentials.companyCode}</span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(credentials.companyCode);
                                        alert('コピーしました');
                                    }}
                                >
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b">
                            <span className="text-foreground/60">ログインメール</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-bold">{credentials.email}</span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(credentials.email);
                                        alert('コピーしました');
                                    }}
                                >
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                        <div className="flex justify-between items-center py-3 border-b">
                            <span className="text-foreground/60">初期パスワード</span>
                            <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-lg text-red-600">{credentials.password}</span>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => {
                                        navigator.clipboard.writeText(credentials.password);
                                        alert('コピーしました');
                                    }}
                                >
                                    <Copy className="w-3 h-3" />
                                </Button>
                            </div>
                        </div>
                    </div>

                    <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                        <p className="text-sm text-yellow-800">
                            <strong>⚠️ 重要</strong><br />
                            このパスワードは一度しか表示されません。必ずコピーして顧客に送信してください。
                        </p>
                    </div>
                </Card>
            )}

            {/* Create Form */}
            <Card className="p-8">
                <form id="create-tenant-form" action={handleSubmit} className="space-y-6">
                    <Input
                        label="企業名"
                        name="company_name"
                        placeholder="例: 株式会社サンプル"
                        required
                    />

                    <div>
                        <label className="block text-sm font-bold text-foreground/70 mb-2">
                            企業コード（5-6桁）
                        </label>
                        <div className="flex gap-2">
                            <Input
                                name="company_code"
                                placeholder="例: 12345"
                                value={companyCode}
                                onChange={(e) => setCompanyCode(e.target.value)}
                                required
                            />
                            <Button
                                type="button"
                                variant="secondary"
                                onClick={handleGenerateCode}
                            >
                                自動生成
                            </Button>
                        </div>
                    </div>

                    <Input
                        label="ログインメールアドレス"
                        name="email"
                        type="email"
                        placeholder="例: admin@example.com"
                        required
                    />

                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                        <div className="flex items-start gap-3">
                            <Key className="w-5 h-5 text-blue-600 mt-0.5" />
                            <div className="text-sm text-blue-800">
                                <p className="font-bold mb-1">パスワード自動生成</p>
                                <p>初期パスワードは8文字の英数字がランダムで自動生成されます。</p>
                            </div>
                        </div>
                    </div>

                    {message && (
                        <div className={`p-4 rounded-lg text-sm ${message.type === 'success'
                            ? 'bg-green-50 text-green-700 border border-green-200'
                            : 'bg-red-50 text-red-700 border border-red-200'
                            }`}>
                            {message.text}
                        </div>
                    )}

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                            {submitting ? '作成中...' : '企業アカウントを作成'}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
