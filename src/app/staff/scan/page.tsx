'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { checkIn, staffLogout, getStaffSession } from '@/app/actions/staff';
import { Button } from '@/components/ui/Button';
import { Camera, LogOut, CheckCircle, AlertTriangle, Search, XCircle } from "lucide-react";

export default function StaffScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<{ eventName: string, tenantName: string } | null>(null);
  const [scanning, setScanning] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [result, setResult] = useState<{
    type: 'success' | 'warning' | 'error',
    message: string,
    name?: string,
    ticketType?: string,
    startTime?: string,
    entryType?: 'first' | 're_entry'
  } | null>(null);

  // Initialize Session
  useEffect(() => {
    getStaffSession().then(s => {
      if (s) setSession(s);
      else staffLogout(); // Redirect if no session
    });
  }, []);

  // Handle Scan Result
  const handleScan = useCallback(async (data: string) => {
    if (!scanning) return;
    setScanning(false); // Pause scanning

    // Call Server Action
    const res = await checkIn(data);

    if (res.success && res.participant) {
      setResult({
        type: 'success',
        message: res.message || 'チェックイン完了',
        name: res.participant.name,
        ticketType: res.participant.ticketType,
        startTime: res.participant.startTime,
        entryType: res.participant.entryType
      });
    } else {
      setResult({
        type: 'error',
        message: res.error || 'エラーが発生しました'
      });
    }
  }, [scanning]);

  // Use a local function for the loop to avoid const scoping issues in requestAnimationFrame
  const tick = useCallback(() => {
    if (!videoRef.current || !canvasRef.current || !scanning) return;

    const loop = () => {
      if (!videoRef.current || !canvasRef.current || !scanning) return;
      if (videoRef.current.readyState === videoRef.current.HAVE_ENOUGH_DATA) {
        const video = videoRef.current;
        const canvas = canvasRef.current;

        canvas.height = video.videoHeight;
        canvas.width = video.videoWidth;

        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

          const code = jsQR(imageData.data, imageData.width, imageData.height, {
            inversionAttempts: "dontInvert",
          });

          if (code && code.data) {
            handleScan(code.data);
            return; // Stop loop
          }
        }
      }
      requestAnimationFrame(loop);
    };
    loop();
  }, [scanning, handleScan]);

  // Camera Logic
  const startCamera = useCallback(async () => {
    if (!videoRef.current) return;
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
      });
      videoRef.current.srcObject = stream;
      videoRef.current.setAttribute("playsinline", "true"); // required to tell iOS safari we don't want fullscreen
      videoRef.current.play();
      tick();
    } catch {
      setResult({ type: 'error', message: 'カメラの起動に失敗しました。権限を確認してください。' });
    }
  }, [tick]);

  useEffect(() => {
    let isMounted = true;

    const init = async () => {
      if (isMounted) {
        await startCamera();
      }
    };
    init();

    const currentVideo = videoRef.current;
    return () => {
      isMounted = false;
      // Cleanup stream
      if (currentVideo?.srcObject) {
        const stream = currentVideo.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // Reset to Scan Mode
  const resetScan = () => {
    setResult(null);
    setScanning(true);
    // Use timeout to ensure state update is processed
    setTimeout(() => {
      tick();
    }, 100);
  };

  return (
    <div className="min-h-screen bg-white text-slate-900 flex flex-col relative overflow-hidden font-sans">
      {/* Background Camera View (Lowered opacity) */}
      <div className="absolute inset-0 z-0 bg-slate-100/50">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover opacity-30 blur-[2px]"
        />
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {/* Modern Overlay: Header */}
      <div className="relative z-20 p-6 flex justify-between items-center border-b border-slate-100 bg-white/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-50 rounded-lg">
            <Camera className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-slate-800">
              QRスキャン中
            </h1>
            {session && (
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                {session.eventName}
              </p>
            )}
          </div>
        </div>
        <form action={staffLogout}>
          <button type="submit" className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-100 hover:text-slate-600 transition-all border border-slate-100">
            <LogOut className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Main Scanner Container */}
      <div className="flex-1 relative z-10 flex flex-col items-center justify-center p-6 bg-gradient-to-b from-white/20 via-transparent to-white/20">

        {/* The "Window" container */}
        <div className="relative w-full max-w-[320px] aspect-square flex items-center justify-center">

          {/* Real clear camera view in the window */}
          <div className="absolute inset-0 rounded-[2.5rem] overflow-hidden border-8 border-white shadow-2xl ring-1 ring-slate-100">
            <video
              ref={(v) => {
                if (v && videoRef.current && v !== videoRef.current) {
                  // We show the same stream in the small window
                  v.srcObject = videoRef.current.srcObject;
                  v.play();
                }
              }}
              className="w-full h-full object-cover scale-110"
              muted
              playsInline
            />
          </div>

          {/* Guidelines Corner Brackets */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-0 left-0 w-12 h-12 border-t-4 border-l-4 border-blue-600 rounded-tl-3xl -mt-1 -ml-1"></div>
            <div className="absolute top-0 right-0 w-12 h-12 border-t-4 border-r-4 border-blue-600 rounded-tr-3xl -mt-1 -mr-1"></div>
            <div className="absolute bottom-0 left-0 w-12 h-12 border-b-4 border-l-4 border-blue-600 rounded-bl-3xl -mb-1 -ml-1"></div>
            <div className="absolute bottom-0 right-0 w-12 h-12 border-b-4 border-r-4 border-blue-600 rounded-br-3xl -mb-1 -mr-1"></div>
          </div>

          {/* Scanning Animation Line */}
          {scanning && !result && (
            <div className="absolute top-0 left-4 right-4 h-1 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-[0_0_15px_rgba(59,130,246,0.8)] animate-scan-line z-30 opacity-80" />
          )}
        </div>

        <div className="mt-10 text-center space-y-2">
          <p className="text-slate-800 font-black text-lg">
            {scanning ? "QRコードをかざしてください" : "処理中..."}
          </p>
          <p className="text-slate-400 text-xs font-bold tracking-wider">
            枠内にQRコードが入るように調整してください
          </p>
        </div>

        {/* Manual Search UI */}
        <div className="mt-8 w-full max-w-[320px]">
          <div className="relative group">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="会員IDを手動入力..."
              className="w-full px-5 py-3.5 bg-white border-2 border-slate-200 rounded-2xl text-sm font-black text-slate-900 focus:outline-none focus:border-blue-600 transition-all placeholder:text-slate-400 pr-12 shadow-sm"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && searchQuery) {
                  handleScan(searchQuery);
                  setSearchQuery("");
                }
              }}
            />
            <button
              onClick={() => {
                if (searchQuery) {
                  handleScan(searchQuery);
                  setSearchQuery("");
                }
              }}
              disabled={!searchQuery}
              className="absolute right-2 top-2 p-2 bg-blue-600 text-white rounded-xl hover:bg-blue-700 disabled:bg-slate-200 transition-all shadow-md shadow-blue-200"
            >
              <Search className="w-4 h-4" />
            </button>
          </div>
          <p className="text-[10px] text-slate-500 font-black text-center mt-3 uppercase tracking-tighter">
            会員IDによる手動チェックインが可能です
          </p>
        </div>
      </div>

      {/* Result Modal - Integrated for modern look */}
      {result && (
        <div className="absolute inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className={`w-full max-w-sm bg-white rounded-xl shadow-2xl overflow-hidden animate-in zoom-in duration-200 ${result.type === 'success' ? 'border-4 border-green-500' : result.type === 'warning' ? 'border-4 border-yellow-500' : 'border-4 border-red-500'}`}>

            {/* Status Banner */}
            <div className={`p-6 text-center ${result.type === 'success' ? 'bg-green-50' : result.type === 'warning' ? 'bg-yellow-50' : 'bg-red-50'}`}>
              {result.type === 'success' && <CheckCircle className="w-16 h-16 mx-auto text-green-500 mb-2" />}
              {result.type === 'warning' && <AlertTriangle className="w-16 h-16 mx-auto text-yellow-500 mb-2" />}
              {result.type === 'error' && <XCircle className="w-16 h-16 mx-auto text-red-500 mb-2" />}

              <h2 className={`text-2xl font-bold ${result.type === 'success' ? 'text-green-700' : result.type === 'warning' ? 'text-yellow-700' : 'text-red-700'}`}>
                {result.type === 'success' ? '確認OK' : result.type === 'warning' ? '注意' : 'エラー'}
              </h2>
            </div>

            {/* Content */}
            <div className="p-6 text-center">
              {result.entryType && (
                <div className="mb-4">
                  <span className={`px-4 py-1.5 rounded-full text-sm font-black tracking-widest ${result.entryType === 'first'
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-200'
                    : 'bg-orange-500 text-white shadow-lg shadow-orange-200'
                    }`}>
                    {result.entryType === 'first' ? '✨ 初入場' : '🔄 途中入場'}
                  </span>
                </div>
              )}

              {result.name && (
                <div className="mb-4">
                  <p className="text-3xl font-black text-slate-800 mt-1">{result.name} 様</p>
                </div>
              )}

              {(result.ticketType || result.startTime) && (
                <div className="bg-slate-50 border border-slate-100 rounded-2xl p-4 mb-6 text-center space-y-2">
                  {result.ticketType && (
                    <div className="flex flex-col items-center">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">券種</span>
                      <span className="text-lg font-black text-slate-900 leading-tight">{result.ticketType}</span>
                    </div>
                  )}
                  {result.startTime && (
                    <div className="flex flex-col items-center pt-2 border-t border-slate-100">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">入場可能時間</span>
                      <span className="text-lg font-black text-slate-900 leading-tight">{result.startTime}</span>
                    </div>
                  )}
                </div>
              )}

              <p className="text-gray-600 font-bold">{result.message}</p>
            </div>

            {/* Footer Button */}
            <div className="p-4 bg-gray-50 border-t border-gray-100">
              <Button onClick={resetScan} className="w-full h-12 text-lg">
                次の人をスキャン
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
