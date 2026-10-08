'use client';

import { useEffect, useRef, useState } from 'react';
import { checkIn, staffLogout, getStaffSession } from '@/app/actions/staff';
import { Camera, LogOut, CheckCircle2, AlertCircle, Pause, ScanLine } from 'lucide-react';

type Result = { ok: boolean; message: string; name?: string; ticketType?: string; startTime?: string; entryType?: 'first' | 're_entry' };

export default function StaffScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const busy = useRef(false);
  const mounted = useRef(false);
  const stopRef = useRef<() => void>(() => {});
  const [session, setSession] = useState<{ eventName: string; tenantName: string } | null>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [result, setResult] = useState<Result | null>(null);

  useEffect(() => {
    mounted.current = true;
    getStaffSession().then(s => {
      if (!mounted.current) return;
      if (s) setSession(s);
      else void staffLogout();
    }).catch(() => { if (mounted.current) setError('ログイン情報を確認できません。ページを再読み込みしてください。'); });
    return () => { mounted.current = false; };
  }, []);

  async function submit(value: string) {
    if (busy.current || !session || !value.trim()) return;
    busy.current = true;
    stopRef.current();
    setActive(false);
    setPending(true);
    setError('');
    try {
      const res = await checkIn(value.trim());
      if (!mounted.current) return;
      setResult(res.success && res.participant
        ? { ok: true, message: res.message || 'チェックイン完了', ...res.participant }
        : { ok: false, message: res.error || '受付情報を確認できませんでした。' });
      setQuery('');
    } catch {
      if (mounted.current) setResult({ ok: false, message: '通信が途切れました。受付済みか管理画面で確認してから再試行してください。' });
    } finally {
      if (mounted.current) setPending(false);
      // Keep the lock until the operator explicitly dismisses the result.
    }
  }
  const submitRef = useRef(submit);
  useEffect(() => { submitRef.current = submit; });

  useEffect(() => {
    if (!active || !session) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    function stop() {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      if (video) { video.pause(); video.srcObject = null; }
    }
    stopRef.current = stop;
    function hide() {
      if (document.hidden) { stop(); setActive(false); setReady(false); }
    }
    function leave() { stop(); setActive(false); setReady(false); }
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);
    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: { ideal: 'environment' }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 15 },
        } });
        if (cancelled || !video) { stream.getTracks().forEach(track => track.stop()); return; }
        video.srcObject = stream;
        await video.play();
        const { default: jsQR } = await import('jsqr');
        if (cancelled) return;
        setReady(true);
        function decode() {
          if (cancelled || !video || !context) return;
          try {
            if (video.readyState >= 2 && video.videoWidth && video.videoHeight) {
              const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
              const width = Math.max(1, Math.round(video.videoWidth * scale));
              const height = Math.max(1, Math.round(video.videoHeight * scale));
              if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
              context.drawImage(video, 0, 0, width, height);
              const pixels = context.getImageData(0, 0, width, height);
              const code = jsQR(pixels.data, width, height, { inversionAttempts: 'dontInvert' });
              if (code?.data) { stop(); void submitRef.current(code.data); return; }
            }
            // Schedule after decoding: no overlapping work or accumulated frames.
            timer = setTimeout(decode, 250);
          } catch { stop(); setActive(false); setReady(false); setError('読み取りを停止しました。カメラを再開するか、IDで受付してください。'); }
        }
        decode();
      } catch (e) {
        if (cancelled) return;
        stop();
        if (!mounted.current) return;
        setActive(false); setReady(false);
        const name = e instanceof Error ? e.name : '';
        setError(name === 'NotAllowedError' ? 'カメラの使用を許可してください。ID入力でも受付できます。' : 'カメラを起動できません。ほかのカメラアプリを閉じて再試行してください。ID入力も利用できます。');
      }
    }
    void start();
    return () => { stop(); document.removeEventListener('visibilitychange', hide); window.removeEventListener('pagehide', leave); };
  }, [active, session]);

  function startCamera() { setError(''); setReady(false); setActive(true); }
  function next() { busy.current = false; setResult(null); }
  const button = 'min-h-12 rounded-xl px-5 py-3 font-bold focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-teal-600 disabled:opacity-40';

  return (
    <div className="min-h-dvh bg-[#f4f6f8] text-slate-900" style={{ fontFamily: 'system-ui, sans-serif', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      <header className="border-b border-slate-200 bg-white px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3"><ScanLine className="h-8 w-8 shrink-0 text-teal-700" /><div className="min-w-0"><p className="text-xs font-bold tracking-widest text-teal-700">EVENT RECEPTION</p><h1 className="text-lg font-bold">入場受付</h1></div></div>
          <form action={staffLogout}><button aria-label="ログアウト" className={`${button} flex items-center gap-2 border border-slate-200 bg-white text-sm`}><LogOut size={18} /><span className="hidden sm:inline">ログアウト</span></button></form>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-6 sm:p-8">
        <div className="mb-6"><p className="text-sm text-slate-500">{session?.tenantName || '受付スタッフ'}</p><h2 className="mt-1 break-words text-xl font-bold sm:text-2xl">{session?.eventName || 'イベント情報を確認中…'}</h2></div>
        <div className="grid items-start gap-5 md:grid-cols-[1.2fr_1fr]">
          <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white" aria-label="QRコード読み取り">
            <div className="flex items-center justify-between gap-3 px-5 py-4"><h3 className="font-bold">QRコードで受付</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold" role="status">{pending ? '受付処理中' : active ? ready ? '読み取り中' : '起動中' : 'カメラ停止中'}</span></div>
            <div className="relative aspect-[4/3] bg-[#152c30]">
              <video ref={videoRef} muted playsInline className={`absolute inset-0 h-full w-full object-contain ${active && ready ? '' : 'invisible'}`} />
              {active && ready ? <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-white/70" /> : <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-6 text-center text-white"><Camera size={40} strokeWidth={1.3} /><p className="font-semibold">{pending ? '受付情報を確認しています' : result ? '受付結果をご確認ください' : active ? 'カメラを準備しています' : '準備ができたらカメラを開始'}</p><p className="text-sm text-slate-300">{active ? 'カメラの使用を許可してください' : '使わない間はカメラを休止します'}</p></div>}
            </div>
            <div className="space-y-3 p-5"><p className="text-sm text-slate-600">QRコード全体が映るようにかざしてください。</p><button disabled={!session || pending || !!result} onClick={active ? () => { stopRef.current(); setActive(false); setReady(false); } : startCamera} className={`${button} flex w-full items-center justify-center gap-2 ${active ? 'bg-slate-100' : 'bg-teal-700 text-white'}`}>{active ? <Pause size={18} /> : <Camera size={18} />}{active ? 'カメラを休止' : 'カメラを開始'}</button></div>
          </section>
          <div className="space-y-5">
            {result && <section role="status" aria-live="polite" className={`rounded-2xl border-2 bg-white p-5 sm:p-6 ${result.ok ? 'border-teal-600' : 'border-amber-500'}`}><div className={`mb-4 flex items-center gap-3 ${result.ok ? 'text-teal-700' : 'text-amber-800'}`}>{result.ok ? <CheckCircle2 size={28} /> : <AlertCircle size={28} />}<h3 className="text-xl font-bold">{result.ok ? result.entryType === 're_entry' ? '再入場を受け付けました' : '入場を受け付けました' : '確認が必要です'}</h3></div>{result.name && <p className="mb-5 break-words text-2xl font-bold">{result.name}<span className="ml-2 text-sm font-normal">様</span></p>}<dl className="space-y-3">{result.ticketType && <div><dt className="text-xs text-slate-500">券種</dt><dd className="break-words font-bold">{result.ticketType}</dd></div>}{result.startTime && <div><dt className="text-xs text-slate-500">入場可能時間</dt><dd className="font-bold">{result.startTime}</dd></div>}</dl><p className="my-4 text-sm text-slate-600">{result.message}</p><button autoFocus onClick={next} className={`${button} w-full bg-teal-700 text-white`}>次の受付へ</button></section>}
            {error && <p role="alert" className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">{error}</p>}
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6"><h3 className="font-bold">IDを入力して受付</h3><p className="mb-5 mt-2 text-sm leading-relaxed text-slate-500">QRコードが読み取れない場合はこちら。</p><form onSubmit={e => { e.preventDefault(); void submit(query); }} className="space-y-3"><label htmlFor="member-id" className="block text-sm font-semibold">会員ID・会社コード</label><input id="member-id" value={query} onChange={e => setQuery(e.target.value)} autoCapitalize="none" autoCorrect="off" spellCheck={false} autoComplete="off" disabled={pending || !!result} className="min-h-12 w-full rounded-xl border border-slate-300 bg-white px-4 text-base focus:outline-teal-600" placeholder="IDを入力" /><button disabled={!session || !query.trim() || pending || !!result} className={`${button} w-full border border-slate-300 bg-slate-50`}>{pending ? '確認しています…' : 'このIDで受付する'}</button></form></section>
            <p className="px-1 text-xs leading-relaxed text-slate-500">受付結果の表示中・画面を離れたときはカメラが停止します。続けるときは「カメラを開始」を押してください。</p>
          </div>
        </div>
      </main>
    </div>
  );
}
