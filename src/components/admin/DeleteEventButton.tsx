'use client';

import { useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { deleteEvent } from '@/app/actions/settings';

type EventTarget = { id: string; name: string; event_code: string };

export default function DeleteEventButton({ event, onDeleted }: { event: EventTarget; onDeleted: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const inputId = useId();
  const [confirmation, setConfirmation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  function open() {
    setConfirmation('');
    setError('');
    dialog.current?.showModal();
  }
  async function remove(e: React.FormEvent) {
    e.preventDefault();
    if (busy || confirmation !== event.name) return;
    setBusy(true);
    setError('');
    try {
      const result = await deleteEvent(event.id, confirmation);
      if (!result.success) { setError(result.error || '削除できませんでした。'); return; }
      dialog.current?.close();
      onDeleted();
    } catch {
      setError('結果を確認できませんでした。画面を更新してイベントが残っているか確認してください。');
    } finally { setBusy(false); }
  }
  return <>
    <button type="button" className="admin-button text-red-700 hover:bg-red-50" aria-label={`${event.name}を削除`} onClick={open}><Trash2 size={14} aria-hidden/>イベントを削除</button>
    <dialog ref={dialog} aria-labelledby={titleId} onCancel={e => { if (busy) e.preventDefault(); }} className="m-auto w-[calc(100%_-_2rem)] max-w-lg max-h-[90dvh] overflow-y-auto rounded-2xl border border-border bg-white p-6 text-foreground shadow-xl backdrop:bg-black/40">
      <form onSubmit={remove} className="space-y-5">
        <h2 id={titleId} className="text-xl font-bold">イベントを削除しますか？</h2>
        <div className="rounded-lg bg-secondary p-4 break-words"><p className="font-bold">{event.name}</p><p className="text-sm mt-1">イベントコード：{event.event_code}</p></div>
        <p className="text-sm leading-7">このイベントと参加者・チケット・入場記録を完全に削除します。元に戻せません。配信済みのメールは取り消せません。</p>
        <p className="text-sm text-foreground/70">会員名簿と、他のイベントのデータは残ります。</p>
        <div><label htmlFor={inputId} className="block text-sm font-bold mb-2">確認のため、イベント名を入力してください</label><input id={inputId} value={confirmation} onChange={e => setConfirmation(e.target.value)} autoComplete="off" disabled={busy} className="w-full rounded-lg border border-border p-3" /></div>
        {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
        <div className="flex flex-wrap justify-end gap-3"><button type="button" autoFocus disabled={busy} onClick={() => dialog.current?.close()} className="admin-button">キャンセル</button><button type="submit" disabled={busy || confirmation !== event.name} className="admin-button bg-red-700! text-white disabled:opacity-40 disabled:cursor-not-allowed">{busy ? '削除中…' : '完全に削除する'}</button></div>
      </form>
    </dialog>
  </>;
}
