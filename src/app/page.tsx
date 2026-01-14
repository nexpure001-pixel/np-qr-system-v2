import Link from "next/link";
import { Button } from "@/components/ui/Button";

export default function Home() {
  return (
    <main className="min-h-screen relative flex items-center">
      {/* Background Image with Gradient Overlay */}
      <div
        className="absolute inset-0 z-0"
        style={{
          backgroundImage: "url('https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2301&auto=format&fit=crop')",
          backgroundSize: 'cover',
          backgroundPosition: 'center',
        }}
      >
        {/* The requested gradient: Clear on left, fading to white on right */}
        <div
          className="absolute inset-0"
          style={{
            background: 'linear-gradient(to right, rgba(255,255,255,0) 40%, rgba(255,255,255,0.8) 70%, rgba(255,255,255,1) 100%)'
          }}
        />
      </div>

      {/* Content Layer (z-10 to sit above background) */}
      <div className="container mx-auto px-4 z-10 relative flex justify-end">
        <div className="max-w-xl text-right md:pr-12">
          <h1 className="text-5xl font-extrabold tracking-tight text-slate-900 mb-6 leading-tight">
            チケットレスで、<br />
            もっと自由なイベントを。
          </h1>
          <p className="text-xl text-slate-600 mb-8 leading-relaxed">
            QRコードすら必要ない。<br />
            名前を伝えるだけで、スムーズな受付体験を。<br />
            社内イベントから大規模カンファレンスまで。
          </p>
          <div className="flex gap-4 justify-end">
            <Link href="/admin/login">
              <Button size="lg" className="text-lg px-8 py-6 shadow-xl hover:shadow-2xl transition-all">
                管理画面へログイン
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </main>
  );
}
