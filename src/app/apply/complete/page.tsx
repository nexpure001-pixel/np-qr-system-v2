import { generateQrCode } from "@/utils/qrcode";
import { CheckCircle, Download } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

export default async function CompletePage({
    searchParams,
}: {
    searchParams: Promise<{ token: string }>;
}) {
    const { token } = await searchParams;

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center text-red-500 font-bold">
                エラー: トークンが見つかりません。
            </div>
        );
    }

    // Server-side QR Generation
    const qrDataUrl = await generateQrCode(token);

    return (
        <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden">
                {/* Header */}
                <div className="bg-green-500 p-6 text-center text-white">
                    <CheckCircle className="w-12 h-12 mx-auto mb-2" />
                    <h1 className="text-2xl font-bold tracking-wider">受付完了</h1>
                    <p className="text-green-100 text-sm">Application Completed</p>
                </div>

                {/* QR Section */}
                <div className="p-8 flex flex-col items-center gap-6">
                    <p className="text-center text-foreground/80 font-medium">
                        以下のQRコードを保存し、<br />
                        当日は受付スタッフにご提示ください。
                    </p>

                    <div className="relative p-4 border-4 border-foreground/10 rounded-xl bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img
                            src={qrDataUrl}
                            alt="Check-in QR Code"
                            width={240}
                            height={240}
                            className="block"
                        />
                    </div>

                    <div className="bg-blue-50 text-blue-800 text-xs p-3 rounded-lg flex items-center gap-2 max-w-sm">
                        <span>ℹ️</span>
                        <span>
                            万が一メールが届かない場合でも、この画面（QRコード）があれば入場可能です。
                        </span>
                    </div>

                    <Link
                        href="/"
                        className="w-full text-center py-3 text-sm text-foreground/50 hover:text-primary transition-colors"
                    >
                        トップページに戻る
                    </Link>
                </div>
            </div>
        </div >
    );
}
