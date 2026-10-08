"use client";
import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import Image from "next/image";
import {
  createStaffInvite,
  getStaffManagement,
  revokeStaffAccess,
  setStaffEventAccess,
} from "@/app/actions/staff-management";

type Management = Awaited<ReturnType<typeof getStaffManagement>>;
const button =
  "min-h-11 rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-40";
const date = (value: string) => new Date(value).toLocaleString("ja-JP");
export default function StaffManagementPage() {
  const [data, setData] = useState<Management | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [label, setLabel] = useState("");
  const [invite, setInvite] = useState<{
    url: string;
    qr: string;
    expiresAt: string;
  } | null>(null);
  const [message, setMessage] = useState("");
  const refresh = useCallback(async () => {
    setData(await getStaffManagement());
  }, []);
  useEffect(() => {
    refresh().catch((e) =>
      setError(e instanceof Error ? e.message : "読み込みに失敗しました。"),
    );
  }, [refresh]);
  async function run(action: () => Promise<void>) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作に失敗しました。");
    } finally {
      setBusy(false);
    }
  }
  return (
    <div
      className="mx-auto max-w-5xl space-y-6 font-sans"
      style={{ fontFamily: "system-ui, sans-serif" }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">スタッフ・受付端末</h1>
          <p className="mt-2 text-sm text-slate-600">
            受付イベントと端末をまとめて管理します。
          </p>
        </div>
        <button
          className={button}
          disabled={busy}
          onClick={() => void run(refresh)}
        >
          最新の状態に更新
        </button>
      </div>
      {error && (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {error}
        </p>
      )}
      {message && (
        <p role="status" className="rounded-xl bg-teal-50 p-4 text-teal-800">
          {message}
        </p>
      )}
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">1. 受付するイベント</h2>
        <p className="my-3 text-sm text-slate-600">
          受付中のイベントだけがスタッフ端末に表示されます。「おすすめ」にしても端末のイベントは自動で切り替わりません。
        </p>
        {!data ? (
          <p>読み込み中…</p>
        ) : !data.events.length ? (
          <p>イベント設定でイベントを作成してください。</p>
        ) : (
          <div className="divide-y">
            {data.events.map((event) => (
              <div
                key={event.id}
                className="flex flex-wrap items-center justify-between gap-3 py-4"
              >
                <div className="min-w-0">
                  <p className="break-words font-bold">{event.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {event.enabled ? "受付中" : "受付停止中"}
                    {event.recommended ? " ・ おすすめ" : ""}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button
                    disabled={busy}
                    className={button}
                    onClick={() => {
                      if (
                        !event.enabled ||
                        window.confirm(
                          `「${event.name}」の受付を終了しますか？ 登録済み端末からも受付できなくなります。`,
                        )
                      )
                        void run(() =>
                          setStaffEventAccess(event.id, !event.enabled, false),
                        );
                    }}
                  >
                    {event.enabled ? "受付を終了" : "受付を開始"}
                  </button>
                  {event.enabled && (
                    <button
                      disabled={busy}
                      className={button}
                      onClick={() =>
                        void run(() =>
                          setStaffEventAccess(
                            event.id,
                            true,
                            !event.recommended,
                          ),
                        )
                      }
                    >
                      {event.recommended ? "おすすめを解除" : "おすすめにする"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">2. スタッフ端末を招待</h2>
        <p className="my-3 text-sm leading-relaxed text-slate-600">
          端末ごとに招待を発行します。招待は24時間・1回限り有効です。登録後7日間、同じ主催者の受付中イベントを切り替えられます。
        </p>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void run(async () => {
              const result = await createStaffInvite(label);
              const url = `${window.location.origin}/staff/join#${result.token}`;
              setInvite({
                url,
                qr: await QRCode.toDataURL(url, { width: 256, margin: 2 }),
                expiresAt: result.expiresAt,
              });
              setLabel("");
            });
          }}
          className="flex flex-wrap items-end gap-3"
        >
          <label className="flex min-w-0 flex-1 flex-col gap-2 text-sm font-semibold">
            端末の名前
            <input
              required
              maxLength={60}
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="例：正面受付・田中さん"
              className="min-h-11 rounded-lg border px-3 text-base"
            />
          </label>
          <button
            className={`${button} bg-teal-700 text-white`}
            disabled={busy || !label.trim()}
          >
            招待QRを発行
          </button>
        </form>
        {invite && (
          <div className="mt-5 rounded-xl bg-slate-50 p-4">
            <p className="font-bold">
              このQRをスタッフのスマホで読み込んでください
            </p>
            <Image
              unoptimized
              src={invite.qr}
              width={256}
              height={256}
              alt="スタッフ端末登録用の招待QRコード"
              className="my-3 max-w-full"
            />
            <label className="block text-sm">
              招待リンク
              <input
                readOnly
                value={invite.url}
                className="my-2 min-h-11 w-full rounded border bg-white px-3"
                onFocus={(e) => e.target.select()}
              />
            </label>
            <button
              className={button}
              onClick={() => {
                navigator.clipboard
                  .writeText(invite.url)
                  .then(() => setMessage("招待リンクをコピーしました。"))
                  .catch(() =>
                    setError("リンクを選択してコピーしてください。"),
                  );
              }}
            >
              リンクをコピー
            </button>
            <p className="mt-3 text-xs text-slate-600">
              有効期限：{date(invite.expiresAt)}
              。QR・リンクはスタッフにだけ共有してください。この画面を閉じると再表示できません。
            </p>
          </div>
        )}
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">3. 登録端末</h2>
        <p className="my-3 text-sm text-slate-600">
          表示は更新時点の状態です。不要な端末を無効化すると、新しい受付を停止できます。
        </p>
        <div className="divide-y">
          {data?.devices.map((device) => (
            <div
              key={device.id}
              className="flex flex-wrap items-center justify-between gap-3 py-4"
            >
              <div className="min-w-0">
                <h3 className="break-words font-bold">{device.label}</h3>
                <p className="text-sm">
                  受付：
                  {data.events.find((e) => e.id === device.current_event_id)
                    ?.name || "未選択"}
                </p>
                <p className="text-xs text-slate-500">
                  最終操作：{date(device.last_seen_at)} ／ 期限：
                  {date(device.expires_at)}
                  {device.allowed_event_id ? " ／ 単一イベント専用" : ""}
                </p>
              </div>
              {device.revoked_at ? (
                <span>無効化済み</span>
              ) : Date.parse(device.expires_at) <= Date.now() ? (
                <span>期限切れ</span>
              ) : (
                <button
                  className={`${button} text-red-700`}
                  disabled={busy}
                  onClick={() => {
                    if (
                      window.confirm(
                        `「${device.label}」を無効化しますか？ 再利用には新しい招待が必要です。`,
                      )
                    )
                      void run(() => revokeStaffAccess("device", device.id));
                  }}
                >
                  端末を無効化
                </button>
              )}
            </div>
          ))}
          {data && !data.devices.length && (
            <p className="py-3 text-sm text-slate-500">
              まだ登録端末はありません。
            </p>
          )}
        </div>
      </section>
      <section className="rounded-2xl border bg-white p-5">
        <h2 className="text-lg font-bold">発行した招待</h2>
        <div className="divide-y">
          {data?.invites.map((item) => (
            <div
              key={item.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div>
                <p className="break-words font-semibold">{item.label}</p>
                <p className="text-xs text-slate-500">
                  期限：{date(item.expires_at)}
                </p>
              </div>
              {item.revoked_at ? (
                <span>無効化済み</span>
              ) : item.consumed_at ? (
                <span>登録済み</span>
              ) : Date.parse(item.expires_at) <= Date.now() ? (
                <span>期限切れ</span>
              ) : (
                <button
                  className={button}
                  disabled={busy}
                  onClick={() =>
                    void run(() => revokeStaffAccess("invite", item.id))
                  }
                >
                  招待を無効化
                </button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
