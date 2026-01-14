import { Card } from "@/components/ui/Card";
import { CheckCircle } from "lucide-react";
import Link from "next/link";

export default function CompletePage() {
    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <Card className="max-w-md w-full p-8 text-center space-y-6">
                <div className="flex justify-center">
                    <div className="bg-green-100 p-4 rounded-full">
                        <CheckCircle className="w-12 h-12 text-green-600" />
                    </div>
                </div>
                <h1 className="text-2xl font-bold text-gray-900">受付を完了しました</h1>
                <p className="text-gray-600">
                    ご入力いただいたメールアドレスに確認メールとQRコードを送信しました。<br />
                    当日はメールに記載のQRコードを提示してください。
                </p>
                <div className="pt-4">
                    <Link href="/">
                        <button className="text-primary font-bold hover:underline">
                            トップへ戻る
                        </button>
                    </Link>
                </div>
            </Card>
        </div>
    );
}
