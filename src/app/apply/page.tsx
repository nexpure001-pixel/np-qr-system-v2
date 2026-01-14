'use client';

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { submitApplication } from "@/app/actions/apply";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Send, Loader2 } from "lucide-react";

export default function ApplyPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const router = useRouter();

    const handleSubmit = async (formData: FormData) => {
        setIsLoading(true);
        setError(null);

        const result = await submitApplication(formData);

        if (result.success && result.token) {
            router.push(`/apply/complete?token=${result.token}`);
        } else {
            if (result.error) {
                setError(result.error);
            } else {
                // Honeypot hit or generic error
                setError('エラーが発生しました。入力を確認してください。');
            }
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
            <div className="max-w-lg w-full space-y-6">
                <div className="text-center space-y-2">
                    <h1 className="text-3xl font-bold text-primary">参加申し込み</h1>
                    <p className="text-foreground/70 text-sm">
                        必要事項を入力して、QRチケットを発行してください。
                    </p>
                </div>

                <Card className="p-8">
                    <form action={handleSubmit} className="space-y-6">
                        {/* Hidden Honeypot */}
                        <input
                            type="text"
                            name="fax_number"
                            className="hidden"
                            autoComplete="off"
                            tabIndex={-1}
                            aria-hidden="true"
                        />

                        <div className="bg-blue-50 p-4 rounded-lg space-y-2 mb-6">
                            <label className="text-xs font-bold text-blue-800 uppercase tracking-wider">
                                Event Selection
                            </label>
                            <Input
                                name="event_code"
                                placeholder="イベントコード (例: 1224)"
                                required
                                className="bg-white border-blue-200 focus:ring-blue-500"
                            />
                        </div>

                        <div className="space-y-4">
                            <Input
                                label="社員番号 / ID (Employee ID)"
                                name="employee_id"
                                required
                            />
                            <Input
                                label="お名前 (Full Name)"
                                name="name"
                                required
                            />
                            <Input
                                label="メールアドレス (Email)"
                                name="email"
                                type="email"
                                required
                            />
                            <Input
                                label="電話番号 (Phone) - 任意"
                                name="phone"
                                type="tel"
                            />
                        </div>

                        {error && (
                            <div className="text-red-600 bg-red-50 p-3 rounded-md text-sm font-bold text-center">
                                {error}
                            </div>
                        )}

                        <Button type="submit" className="w-full h-12 text-lg" disabled={isLoading}>
                            {isLoading ? (
                                <>
                                    <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                                    処理中...
                                </>
                            ) : (
                                <>
                                    <Send className="mr-2 h-5 w-5" />
                                    チケットを発行する
                                </>
                            )}
                        </Button>
                    </form>
                </Card>

                <p className="text-center text-xs text-foreground/40">
                    Protected by Anti-Spam Check
                </p>
            </div>
        </div>
    );
}
