'use client';

import { autoGenerateCompanyCode, createTenantAccount } from "@/app/actions/super-admin";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Loader2, ArrowLeft, Key } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

interface Credentials {
    email: string;
    password?: string;
    companyCode: string;
}

export default function CreateTenantPage() {
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<Credentials | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Auto generate code on mount or button click
    const handleGenerateCode = async () => {
        const code = await autoGenerateCompanyCode();
        const input = document.getElementById('company_code') as HTMLInputElement;
        if (input) input.value = code;
    };

    const handleSubmit = async (formData: FormData) => {
        setLoading(true);
        setError(null);
        setResult(null);

        const res = await createTenantAccount(formData);

        if (res.success && res.credentials) {
            setResult(res.credentials);
        } else {
            setError(res.error || 'Unknown error');
        }
        setLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/admin/super/tenants" className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                    <ArrowLeft className="w-5 h-5 text-gray-500" />
                </Link>
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">新規テナント作成</h1>
                    <p className="text-gray-500">新しい企業アカウントを発行します。</p>
                </div>
            </div>

            {result ? (
                <Card className="p-8 bg-green-50 border-green-200 shadow-sm animate-in fade-in slide-in-from-bottom-4 duration-500">
                    <div className="text-center mb-8">
                        <div className="inline-flex justify-center items-center w-16 h-16 bg-green-100 rounded-full mb-4 text-green-600">
                            <Key className="w-8 h-8" />
                        </div>
                        <h2 className="text-2xl font-bold text-green-900">アカウント作成完了</h2>
                        <p className="text-green-700 mt-2">以下の情報を管理者に共有してください。</p>
                    </div>

                    <div className="bg-white p-6 rounded-lg border border-green-200 space-y-4 shadow-sm">
                        <div>
                            <label className="text-xs font-bold text-gray-400 uppercase">ログインEmail</label>
                            <div className="text-lg font-mono font-bold text-gray-900 select-all">{result.email}</div>
                        </div>
                        <div className="border-t border-gray-100 pt-4">
                            <label className="text-xs font-bold text-gray-400 uppercase">パスワード</label>
                            <div className="text-2xl font-mono font-bold text-blue-600 select-all">{result.password}</div>
                        </div>
                        <div className="border-t border-gray-100 pt-4">
                            <label className="text-xs font-bold text-gray-400 uppercase">企業コード</label>
                            <div className="text-lg font-mono font-bold text-gray-900 select-all">{result.companyCode}</div>
                        </div>
                    </div>

                    <div className="mt-8 flex justify-center gap-4">
                        <Button variant="secondary" onClick={() => window.location.reload()}>
                            続けて作成
                        </Button>
                        <Link href="/admin/super/tenants">
                            <Button>一覧に戻る</Button>
                        </Link>
                    </div>
                </Card>
            ) : (
                <Card className="p-8">
                    <form action={handleSubmit} className="space-y-6">
                        <Input
                            name="company_name"
                            label="企業名"
                            placeholder="株式会社Example"
                            required
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">企業コード (ユニークID)</label>
                            <div className="flex gap-2">
                                <input
                                    id="company_code"
                                    name="company_code"
                                    type="text"
                                    required
                                    className="flex-1 px-4 py-2 border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none font-mono"
                                    placeholder="ex001"
                                />
                                <Button type="button" variant="secondary" onClick={handleGenerateCode}>
                                    自動生成
                                </Button>
                            </div>
                            <p className="text-xs text-gray-400">システム内で一意のIDです。</p>
                        </div>

                        <Input
                            name="email"
                            type="email"
                            label="管理者メールアドレス"
                            placeholder="admin@example.co.jp"
                            required
                        />

                        {error && (
                            <div className="p-4 bg-red-50 text-red-600 text-sm font-bold rounded-lg flex items-center gap-2">
                                <span className="text-xl">⚠️</span> {error}
                            </div>
                        )}

                        <div className="pt-4">
                            <Button type="submit" className="w-full py-6 text-lg" disabled={loading}>
                                {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "アカウントを発行する"}
                            </Button>
                        </div>
                    </form>
                </Card>
            )}
        </div>
    );
}
