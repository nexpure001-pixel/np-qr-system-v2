'use client';

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Save, ShieldCheck, Loader2 } from "lucide-react";
import { useState, useEffect } from "react";
import { getSMTPSettings, updateSMTPSettings } from "@/app/actions/settings";

export default function SmtpSettingsPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [settings, setSettings] = useState<any>(null);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Load existing settings
    useEffect(() => {
        getSMTPSettings().then(data => {
            setSettings(data);
        });
    }, []);

    const handleSubmit = async (formData: FormData) => {
        setIsLoading(true);
        setMessage(null);

        const result = await updateSMTPSettings(formData);

        if (result.success) {
            setMessage({ type: 'success', text: 'SMTP設定を保存しました。' });
            // Reload settings
            const updated = await getSMTPSettings();
            setSettings(updated);
        } else {
            setMessage({ type: 'error', text: result.error || '保存に失敗しました。' });
        }

        setIsLoading(false);
    };

    return (
        <div className="max-w-2xl mx-auto space-y-6">
            <div className="space-y-2">
                <h1 className="text-2xl font-bold text-foreground">
                    SMTP送信設定
                </h1>
                <p className="text-foreground/70 text-sm">
                    企業独自のメールサーバーを設定します。パスワードは暗号化して保存され、画面には表示されません。
                </p>
            </div>

            <Card className="p-8">
                <form action={handleSubmit} className="space-y-6">
                    <div className="grid grid-cols-2 gap-6">
                        <Input
                            label="SMTPホスト (Host)"
                            placeholder="smtp.onamae.ne.jp"
                            name="smtp_host"
                            defaultValue={settings?.smtp_host || ''}
                            required
                        />
                        <Input
                            label="ポート (Port)"
                            placeholder="587"
                            name="smtp_port"
                            type="number"
                            defaultValue={settings?.smtp_port || ''}
                            required
                        />
                    </div>

                    <div className="space-y-4">
                        <Input
                            label="ユーザー名 / ログインID"
                            placeholder="user@example.com"
                            name="smtp_user"
                            defaultValue={settings?.smtp_user || ''}
                            required
                        />

                        <div className="space-y-2">
                            <Input
                                label="SMTPパスワード"
                                placeholder={settings?.smtp_password ? "••••••••（変更する場合のみ入力）" : "パスワードを入力"}
                                name="smtp_password"
                                type="password"
                                required={!settings?.smtp_password}
                            />
                            <p className="text-xs text-foreground/50 flex items-center gap-1">
                                <ShieldCheck className="w-3 h-3" />
                                セキュリティのため、現在のパスワードは表示されません
                            </p>
                        </div>
                    </div>

                    <hr className="border-border" />

                    <Input
                        label="送信元アドレス (From)"
                        placeholder="noreply@example.com"
                        name="smtp_from_email"
                        type="email"
                        defaultValue={settings?.smtp_from_email || ''}
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

                    <div className="flex justify-end pt-4">
                        <Button type="submit" disabled={isLoading} className="w-full sm:w-auto">
                            {isLoading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    保存中...
                                </>
                            ) : (
                                <>
                                    <Save className="w-4 h-4 mr-2" />
                                    設定を保存する
                                </>
                            )}
                        </Button>
                    </div>
                </form>
            </Card>
        </div>
    );
}
