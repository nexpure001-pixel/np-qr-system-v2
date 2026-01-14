'use client';

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { staffLogin } from "@/app/actions/staff";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { QrCode, Building2, Ticket, KeyRound, Loader2 } from "lucide-react";

export default function StaffLoginPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (formData: FormData) => {
    setLoading(true);
    setError("");

    const result = await staffLogin(formData);

    if (!result.success) {
      setError(result.error || "ログインに失敗しました");
      setLoading(false);
    } else {
      router.push('/staff/scan');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-serif">
      <Card className="w-full max-w-md p-8 shadow-xl border-t-4 border-t-primary">
        <div className="text-center mb-8">
          <div className="mx-auto w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mb-4">
            <QrCode className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold text-gray-900 tracking-tight">スタッフ・受付ログイン</h1>
          <p className="text-sm text-gray-500 mt-2">
            イベント情報を入力して、<br />QRコード読み取りを開始してください。
          </p>
        </div>

        {error && (
          <div className="mb-6 p-3 bg-red-50 text-red-600 text-sm font-bold rounded border border-red-100 text-center">
            {error}
          </div>
        )}

        <form action={handleSubmit} className="space-y-5">
          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Building2 className="w-3 h-3" /> 企業コード
            </label>
            <Input
              name="company_code"
              placeholder="例: toyota"
              required
              className="font-mono bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <Ticket className="w-3 h-3" /> イベントコード
            </label>
            <Input
              name="event_code"
              placeholder="例: event2025"
              required
              className="font-mono bg-white"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-bold text-gray-400 uppercase tracking-wider flex items-center gap-1">
              <KeyRound className="w-3 h-3" /> スタッフパスコード
            </label>
            <Input
              type="password"
              name="passcode"
              placeholder="例: 1234"
              required
              className="font-mono bg-white"
            />
          </div>

          <Button type="submit" className="w-full py-6 text-lg" disabled={loading}>
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "スキャン画面へ"}
          </Button>
        </form>
      </Card>

      <div className="fixed bottom-4 text-center w-full text-xs text-gray-300">
        Ticketless Staff System
      </div>
    </div>
  );
}
