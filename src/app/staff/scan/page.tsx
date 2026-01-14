'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import jsQR from 'jsqr';
import { checkIn, staffLogout, getStaffSession } from '@/app/actions/staff';
import { Button } from '@/components/ui/Button';
import { Loader2, LogOut, CheckCircle, AlertTriangle, XCircle, Camera } from 'lucide-react';

export default function StaffScanPage() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [session, setSession] = useState<{ eventName: string, tenantName: string } | null>(null);
  const [scanning, setScanning] = useState(true);
  const [result, setResult] = useState<{ type: 'success' | 'warning' | 'error', message: string, name?: string } | null>(null);

  // Initialize Session
  useEffect(() => {
    getStaffSession().then(s => {
      if (s) setSession(s);
      else staffLogout(); // Redirect if no session
    });
  }, []);

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
      requestAnimationFrame(tick);
    } catch (err) {
      console.error("Camera Error:", err);
      setResult({ type: 'error', message: 'カメラの起動に失敗しました。権限を確認してください。' });
    }
  }, []);

  useEffect(() => {
    startCamera();
    return () => {
      // Cleanup stream
      if (videoRef.current?.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        stream.getTracks().forEach(track => track.stop());
      }
    };
  }, [startCamera]);

  // Scan Loop
  const tick = () => {
    if (!videoRef.current || !canvasRef.current) return;
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
          return; // Stop ticking while handling
        }
      }
    }
    if (scanning) {
      requestAnimationFrame(tick);
    }
  };

  // Handle Scan Result
  const handleScan = async (data: string) => {
    if (!scanning) return;
    setScanning(false); // Pause scanning

    // Call Server Action
    const res = await checkIn(data);

    if (res.success) {
      setResult({
        type: 'success',
        message: res.message || 'チェックイン完了',
        name: res.participant?.name
      });
    } else {
      if (res.errorCode === 'ALREADY_CHECKED_IN') {
        setResult({
          type: 'warning',
          message: res.error || '既にチェックイン済みです',
          name: res.participant?.name
        });
      } else {
        setResult({
          type: 'error',
          message: res.error || 'エラーが発生しました'
        });
      }
    }
  };

  // Reset to Scan Mode
  const resetScan = () => {
    setResult(null);
    setScanning(true);
    requestAnimationFrame(tick);
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col relative overflow-hidden">
      {/* Camera View */}
      <video ref={videoRef} className="absolute inset-0 w-full h-full object-cover opacity-80" />
      <canvas ref={canvasRef} className="hidden" />

      {/* Overlay: Header */}
      <div className="absolute top-0 left-0 right-0 p-4 bg-gradient-to-b from-black/80 to-transparent z-10 flex justify-between items-start">
        <div>
          <h1 className="text-lg font-bold flex items-center gap-2">
            <Camera className="w-5 h-5 text-green-400" />
            QRスキャン中
          </h1>
          {session && (
            <p className="text-xs text-gray-300 mt-1">
              {session.tenantName} / {session.eventName}
            </p>
          )}
        </div>
        <form action={staffLogout}>
          <button type="submit" className="p-2 bg-white/10 rounded-full hover:bg-white/20 transition-colors">
            <LogOut className="w-5 h-5" />
          </button>
        </form>
      </div>

      {/* Overlay: Target Box */}
      {scanning && !result && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none z-0">
          <div className="w-64 h-64 border-2 border-green-400/50 rounded-lg relative">
            <div className="absolute top-0 left-0 w-4 h-4 border-t-4 border-l-4 border-green-500 -mt-1 -ml-1"></div>
            <div className="absolute top-0 right-0 w-4 h-4 border-t-4 border-r-4 border-green-500 -mt-1 -mr-1"></div>
            <div className="absolute bottom-0 left-0 w-4 h-4 border-b-4 border-l-4 border-green-500 -mb-1 -ml-1"></div>
            <div className="absolute bottom-0 right-0 w-4 h-4 border-b-4 border-r-4 border-green-500 -mb-1 -mr-1"></div>
            <div className="absolute inset-0 bg-green-500/10 animate-pulse"></div>
          </div>
          <p className="absolute mt-80 text-sm font-bold text-green-400 animate-bounce">
            QRコードを枠内にかざしてください
          </p>
        </div>
      )}

      {/* Result Modal */}
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
              {result.name && (
                <div className="mb-4">
                  <p className="text-xs text-gray-400 uppercase tracking-widest font-bold">GUEST</p>
                  <p className="text-3xl font-bold text-gray-800 font-serif mt-1">{result.name} 様</p>
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
