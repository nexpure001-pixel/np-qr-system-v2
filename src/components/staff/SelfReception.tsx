"use client";

import { useEffect, useRef, useState } from 'react';
import { Camera, CheckCircle2, AlertCircle, Pause, SwitchCamera } from 'lucide-react';
import { checkIn } from '@/app/actions/staff';
import { createScanGate, ticketToken } from '@/lib/staff/scan-gate';

type Outcome = { ok: boolean; title: string; detail: string; name?: string; ticketType?: string };

export default function SelfReception({ eventId, eventName, onExit }: {
  eventId: string; eventName: string; onExit: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const [facing, setFacing] = useState<'user' | 'environment'>('user');
  const [pending, setPending] = useState(false);
  const [outcome, setOutcome] = useState<Outcome | null>(null);
  const [error, setError] = useState('');
  const locked = useRef(false);
  const alive = useRef(false);
  const gate = useRef(createScanGate());
  const resetTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const stopRef = useRef<() => void>(() => {});

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
      clearTimeout(resetTimer.current);
      stopRef.current();
    };
  }, []);

  useEffect(() => {
    if (!active) return;
    let cancelled = false;
    let stream: MediaStream | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let wake: WakeLockSentinel | undefined;
    const video = videoRef.current;
    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d', { willReadFrequently: true });
    function stop() {
      cancelled = true;
      clearTimeout(timer);
      stream?.getTracks().forEach(track => track.stop());
      void wake?.release().catch(() => {});
      if (video) { video.pause(); video.srcObject = null; }
    }
    stopRef.current = stop;
    function hide() {
      if (!document.hidden) return;
      stop();
      setActive(false);
      setReady(false);
    }
    function leave() { stop(); setActive(false); setReady(false); }
    document.addEventListener('visibilitychange', hide);
    window.addEventListener('pagehide', leave);

    async function accept(value: string) {
      if (locked.current || cancelled) return;
      locked.current = true;
      setPending(true);
      const token = ticketToken(value);
      try {
        const response = token ? await checkIn(token, eventId) : null;
        if (!alive.current) return;
        setOutcome(response?.success ? {
          ok: true,
          title: response.participant?.entryType === 're_entry' ? '受付完了（再入場）' : '受付完了',
          name: response.participant?.name,
          ticketType: response.participant?.ticketType,
          detail: 'QRコードを離して、そのままお進みください。',
        } : {
          ok: false,
          title: 'スタッフにお声がけください',
          detail: token ? '受付を完了できませんでした。スタッフが確認いたします。' : 'チケットメールにあるQRコードをかざしてください。',
        });
        resetTimer.current = setTimeout(() => {
          if (!alive.current) return;
          setOutcome(null);
          locked.current = false;
        }, response?.success ? 3500 : 6000);
      } catch {
        if (!alive.current) return;
        // The request may have reached the server. Stop instead of silently retrying.
        stop();
        setActive(false);
        setReady(false);
        setError('通信を確認できません。スタッフが受付状態を確認してから再開してください。');
        locked.current = false;
      } finally {
        if (alive.current) setPending(false);
      }
    }

    async function start() {
      try {
        if (!navigator.mediaDevices?.getUserMedia || !context) throw new Error('unsupported');
        stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: {
          facingMode: { ideal: facing }, width: { ideal: 640 }, height: { ideal: 480 }, frameRate: { ideal: 15, max: 15 },
        } });
        if (cancelled || !video) { stream.getTracks().forEach(track => track.stop()); return; }
        video.srcObject = stream;
        await video.play();
        const { default: jsQR } = await import('jsqr');
        if (cancelled) return;
        setReady(true);
        // Screen Wake Lock is optional; camera operation does not depend on support.
        if (navigator.wakeLock) void navigator.wakeLock.request('screen').then(lock => {
          if (cancelled) void lock.release(); else wake = lock;
        }).catch(() => {});
        function decode() {
          if (cancelled || !video || !context) return;
          try {
            // No image decoding while a result is being displayed or a request is in flight.
            if (!locked.current && video.readyState >= 2 && video.videoWidth && video.videoHeight) {
              const scale = Math.min(1, 640 / Math.max(video.videoWidth, video.videoHeight));
              const width = Math.max(1, Math.round(video.videoWidth * scale));
              const height = Math.max(1, Math.round(video.videoHeight * scale));
              if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
              context.drawImage(video, 0, 0, width, height);
              const pixels = context.getImageData(0, 0, width, height);
              const code = jsQR(pixels.data, width, height, { inversionAttempts: 'dontInvert' });
              if (gate.current(code?.data || null, performance.now()) && code) void accept(code.data);
            }
            timer = setTimeout(decode, 250);
          } catch {
            stop(); setActive(false); setReady(false);
            setError('カメラの読み取りを停止しました。スタッフがカメラを再開してください。');
          }
        }
        decode();
      } catch {
        if (cancelled) return;
        stop(); setActive(false); setReady(false);
        setError('カメラを起動できません。カメラの使用許可を確認して再開してください。');
      }
    }
    void start();
    return () => {
      stop();
      document.removeEventListener('visibilitychange', hide);
      window.removeEventListener('pagehide', leave);
    };
  }, [active, eventId, facing]);

  const button = 'min-h-12 rounded-xl border px-4 py-3 text-sm font-bold disabled:opacity-40';
  return <main className="min-h-dvh bg-slate-50 px-4 py-5 text-slate-900 sm:p-8" style={{ paddingBottom: 'max(20px, env(safe-area-inset-bottom))' }}>
    <div className="mx-auto max-w-3xl">
      <p className="text-center text-sm font-bold text-teal-700">セルフ受付</p>
      <h1 className="mt-2 text-center text-lg font-bold sm:text-2xl">{eventName}</h1>
      <h2 className="my-5 text-center text-2xl font-bold sm:text-4xl">QRコードをかざしてください</h2>
      <p className="mb-5 text-center text-slate-600">チケットメールのQRコードを、カメラに向けてください。</p>
      <section className="relative aspect-[4/3] overflow-hidden rounded-3xl bg-slate-900" aria-label="セルフ受付カメラ">
        <video ref={videoRef} muted playsInline className={`absolute inset-0 h-full w-full object-contain ${ready && active ? '' : 'invisible'}`} />
        {ready && active && !pending && !outcome && <div className="pointer-events-none absolute inset-[12%] rounded-2xl border-2 border-white/80" />}
        {(!ready || !active) && !pending && !outcome && <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center text-white"><Camera size={48} /><p className="text-xl font-bold">{active ? 'カメラを準備しています' : '受付は一時停止中です'}</p><p>スタッフが受付を開始します。</p></div>}
        {pending && <div role="status" aria-live="polite" className="absolute inset-0 flex flex-col items-center justify-center gap-5 bg-white p-6 text-center text-slate-900">
          <h3 className="text-2xl font-bold sm:text-4xl">受付を確認しています</h3>
          <p className="text-base sm:text-xl">そのまま少々お待ちください。</p>
        </div>}
      </section>
      {outcome && !pending && <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-slate-950/50 p-4" style={{ paddingTop: 'max(16px, env(safe-area-inset-top))', paddingBottom: 'max(16px, env(safe-area-inset-bottom))' }}>
        <section role="status" aria-live="polite" aria-atomic="true" className={`my-auto max-h-full w-full max-w-lg overflow-y-auto rounded-3xl border-t-8 bg-white p-6 text-center shadow-2xl sm:p-10 ${outcome.ok ? 'border-teal-500' : 'border-amber-500'}`}>
          {outcome.ok ? <CheckCircle2 aria-hidden="true" className="mx-auto mb-4 text-teal-600" size={56} /> : <AlertCircle aria-hidden="true" className="mx-auto mb-4 text-amber-600" size={56} />}
          <h3 className={`text-2xl font-bold sm:text-3xl ${outcome.ok ? 'text-teal-800' : 'text-amber-900'}`}>{outcome.title}</h3>
          {outcome.ok ? <div className="my-7 space-y-5">
            <p className={`inline-block max-w-full break-words rounded-full px-5 py-2 text-lg font-bold sm:text-xl ${outcome.ticketType === 'Premium Pass' ? 'bg-orange-50 text-orange-800' : outcome.ticketType === 'Invitation Pass' ? 'bg-violet-50 text-violet-800' : 'bg-slate-100 text-slate-800'}`}>{outcome.ticketType || '券種未設定'}</p>
            <p className="break-words text-3xl font-bold leading-relaxed text-slate-900 sm:text-4xl">{outcome.name || '氏名未登録'}<span className="ml-2 inline-block text-lg font-normal">様</span></p>
          </div> : <p className="my-6 text-base text-slate-700">{outcome.detail}</p>}
          <p className="text-sm text-slate-500">QRコードを離してください。自動で次の受付に戻ります。</p>
        </section>
      </div>}
      {error && <p role="alert" className="mt-4 rounded-xl border border-amber-300 bg-amber-50 p-4 text-amber-900">{error}</p>}
      <div className="mt-5 flex flex-wrap justify-center gap-3">
        <button className={`${button} ${active ? 'bg-white' : 'bg-teal-700 text-white'}`} disabled={pending || !!outcome} onClick={() => {
          if (active) { stopRef.current(); setActive(false); setReady(false); }
          else { setError(''); setReady(false); setActive(true); }
        }}>{active ? <Pause className="mr-2 inline" size={18} /> : <Camera className="mr-2 inline" size={18} />}{active ? '受付を一時停止' : 'セルフ受付を開始'}</button>
        <button className={`${button} bg-white`} disabled={active || pending || !!outcome} onClick={() => setFacing(facing === 'user' ? 'environment' : 'user')}><SwitchCamera className="mr-2 inline" size={18} />{facing === 'user' ? '前面カメラ' : '背面カメラ'}</button>
        <button className={`${button} bg-white`} disabled={pending || !!outcome} onClick={() => { if (confirm('セルフ受付を終了してスタッフ画面へ戻りますか？')) onExit(); }}>スタッフ画面へ戻る</button>
      </div>
      <p className="mt-4 text-center text-xs leading-relaxed text-slate-500">カメラの切り替えは一時停止中に行えます。画面を離れるとカメラは停止します。</p>
    </div>
  </main>;
}
