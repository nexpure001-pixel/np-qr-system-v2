'use client';

import { login } from "@/app/auth/actions";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { useState } from "react";
import { Loader2, ShieldCheck } from "lucide-react";

export default function LoginPage() {
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleSubmit = async (formData: FormData) => {
        setLoading(true);
        setError(null);
        const res = await login(formData);
        // Note: If success, `login` throws redirect, so we won't reach here usually.
        // If we do, it's an error object.
        if (res?.error) {
            setError(res.error);
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen flex items-center justify-center bg-secondary/30 p-4">
            <Card className="w-full max-w-md p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="inline-flex justify-center items-center w-16 h-16 bg-primary/10 rounded-full mb-4 text-primary">
                        <ShieldCheck className="w-8 h-8" />
                    </div>
                    <h1 className="text-2xl font-bold tracking-wider">管理者ログイン</h1>
                    <p className="text-sm text-foreground/60 mt-2">Ticketless Event Management</p>
                </div>

                <form action={handleSubmit} className="space-y-6">
                    <Input
                        name="email"
                        type="email"
                        label="メールアドレス"
                        placeholder="admin@example.com"
                        required
                        autoComplete="email"
                    />
                    <Input
                        name="password"
                        type="password"
                        label="パスワード"
                        placeholder="••••••••"
                        required
                        autoComplete="current-password"
                    />

                    {error && (
                        <div className="text-red-500 text-sm font-bold bg-red-50 p-3 rounded-md">
                            {error}
                        </div>
                    )}

                    <Button type="submit" className="w-full py-6 text-lg shadow-lg hover:shadow-xl transition-all" disabled={loading}>
                        {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "ログイン"}
                    </Button>
                </form>
            </Card>

            <div className="absolute bottom-4 text-center text-xs text-foreground/30 font-serif">
                &copy; 2025 Ticketless System. All rights reserved.
            </div>
        </div>
    );
}
