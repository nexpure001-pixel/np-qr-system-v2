"use client";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { redeemStaffInvite } from "@/app/actions/staff";
export default function StaffJoinPage() {
  const token = useRef("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const router = useRouter();
  useEffect(() => {
    if (window.location.hash) token.current = window.location.hash.slice(1);
    // Keep credentials out of URLs, request logs and referrers after loading.
    window.history.replaceState(null, "", window.location.pathname);
  }, []);
  async function join() {
    setBusy(true);
    setError("");
    try {
      const result = await redeemStaffInvite(token.current);
      if (result.success) router.replace("/staff/scan");
      else setError(result.error || "登録できませんでした。");
    } catch {
      setError("通信に失敗しました。管理者に登録状態を確認してください。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <main className="flex min-h-dvh items-center justify-center bg-slate-50 p-5 font-sans">
      <section className="w-full max-w-md space-y-5 rounded-2xl border bg-white p-6">
        <p className="text-sm font-bold text-teal-700">EVENT RECEPTION</p>
        <h1 className="text-2xl font-bold">このスマホを受付端末に登録</h1>
        <p className="text-sm leading-relaxed text-slate-600">
          管理者から届いた招待で登録します。登録後7日間、主催者が受付を開始したイベントを選べます。
        </p>
        {error && (
          <p role="alert" className="text-red-700">
            {error}
          </p>
        )}
        <button
          disabled={busy}
          onClick={() => void join()}
          className="min-h-12 w-full rounded-xl bg-teal-700 px-4 py-3 font-bold text-white disabled:opacity-40"
        >
          {busy ? "登録しています…" : "この端末を登録して受付へ"}
        </button>
        <p className="text-xs text-slate-500">
          招待は1回限りです。期限切れの場合は管理者に再発行を依頼してください。
        </p>
      </section>
    </main>
  );
}
