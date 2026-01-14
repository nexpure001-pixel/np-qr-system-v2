'use client';

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createEvent, getEvents, deleteEvent } from "@/app/actions/settings";
import { useEffect, useState } from "react";
import { Plus, List, Loader2, Copy, Check, Trash2, AlertTriangle } from "lucide-react";

export default function EventSettingsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [createdEvent, setCreatedEvent] = useState<any>(null); // To show URL after creation
    const [error, setError] = useState<string | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ show: boolean, event: any | null }>({ show: false, event: null });
    const [deleting, setDeleting] = useState(false);

    const fetchEvents = () => {
        getEvents().then(data => {
            setEvents(data);
            setLoading(false);
        });
    };

    useEffect(() => {
        fetchEvents();
    }, []);

    const handleCreate = async (formData: FormData) => {
        setSubmitting(true);
        setError(null);
        setCreatedEvent(null);

        const result = await createEvent(formData);

        if (result.success) {
            setCreatedEvent(result.event);
            fetchEvents(); // Refresh list
            // Reset form? A bit hard with standard form action unless we use ref.
            // For now, let's just let it stay or maybe reset manually if we had controlled inputs.
            // standard <form> reset:
            (document.getElementById('create-event-form') as HTMLFormElement)?.reset();
        } else {
            setError(result.error || '作成に失敗しました。');
        }
        setSubmitting(false);
    };

    const handleDeleteClick = (event: any) => {
        setDeleteModal({ show: true, event });
    };

    const handleDeleteConfirm = async () => {
        if (!deleteModal.event) return;

        setDeleting(true);
        const result = await deleteEvent(deleteModal.event.id);

        if (result.success) {
            alert('イベントを削除しました。');
            setDeleteModal({ show: false, event: null });
            fetchEvents(); // Reload list
        } else {
            alert('削除に失敗しました: ' + result.error);
        }

        setDeleting(false);
    };

    return (
        <div className="space-y-12 max-w-4xl mx-auto">

            {/* Staff QR Scan URL Section */}
            <section className="space-y-4">
                <Card className="p-6 bg-gradient-to-r from-green-50 to-emerald-50 border-2 border-green-200">
                    <div className="flex items-start gap-4">
                        <div className="p-3 bg-green-100 rounded-lg">
                            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v1m6 11h2m-6 0h-2v4m0-11v3m0 0h.01M12 12h4.01M16 20h4M4 12h4m12 0h.01M5 8h2a1 1 0 001-1V5a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1zm12 0h2a1 1 0 001-1V5a1 1 0 00-1-1h-2a1 1 0 00-1 1v2a1 1 0 001 1zM5 20h2a1 1 0 001-1v-2a1 1 0 00-1-1H5a1 1 0 00-1 1v2a1 1 0 001 1z" />
                            </svg>
                        </div>
                        <div className="flex-1">
                            <h2 className="text-lg font-bold text-green-800 mb-1">
                                📱 スタッフ用QRスキャンURL
                            </h2>
                            <p className="text-sm text-green-700 mb-3">
                                このURLをスタッフに共有してください。イベント当日の受付で使用します。
                            </p>
                            <div className="flex gap-2 items-center">
                                <code className="text-sm bg-white border border-green-300 px-4 py-2 rounded-lg flex-1 font-mono">
                                    {typeof window !== 'undefined' ? window.location.origin : ''}/staff/scan
                                </code>
                                <Button
                                    variant="secondary"
                                    onClick={() => {
                                        navigator.clipboard.writeText(`${window.location.origin}/staff/scan`);
                                        alert('スタッフ用URLをコピーしました');
                                    }}
                                    className="bg-green-600 hover:bg-green-700 text-white"
                                >
                                    <Copy className="w-4 h-4 mr-2" />
                                    コピー
                                </Button>
                            </div>
                            <p className="text-xs text-green-600 mt-2">
                                💡 スタッフはこのURLにアクセス後、イベントコードとスタッフパスコードを入力してQRスキャンを開始します
                            </p>
                        </div>
                    </div>
                </Card>
            </section>

            {/* 1. Create Event Section */}
            <section className="space-y-4">
                <div>
                    <h1 className="text-2xl font-bold flex items-center gap-2">
                        <Plus className="w-6 h-6 text-primary" />
                        イベント新規作成
                    </h1>
                    <p className="text-foreground/70 text-sm">
                        新しいイベントを作成し、募集用URLを発行します。
                    </p>
                </div>

                <Card className="p-8 border-l-4 border-l-primary">
                    <form id="create-event-form" action={handleCreate} className="space-y-6">
                        <Input
                            name="name"
                            label="イベント名"
                            placeholder="例: 2025年 新卒採用説明会"
                            required
                        />
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <Input
                                name="event_code"
                                label="イベントコード (参加者配布用)"
                                placeholder="例: 2025"
                                required
                            />
                            <Input
                                name="staff_passcode"
                                label="スタッフパスコード (管理用)"
                                placeholder="例: 9999"
                                required
                            />
                        </div>

                        {error && <p className="text-red-500 font-bold text-sm">{error}</p>}

                        <div className="flex justify-end">
                            <Button type="submit" disabled={submitting} className="w-full md:w-auto">
                                {submitting ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Plus className="w-4 h-4 mr-2" />}
                                イベントを作成する
                            </Button>
                        </div>
                    </form>
                </Card>

                {/* Success / URL Display */}
                {createdEvent && (
                    <div className="bg-green-50 border border-green-200 p-6 rounded-xl animate-in fade-in slide-in-from-top-4">
                        <h3 className="text-green-800 font-bold mb-2 flex items-center gap-2">
                            <Check className="w-5 h-5" />
                            イベントを作成しました！
                        </h3>
                        <p className="text-sm text-green-700 mb-4">
                            以下のURLを参加対象の社員に共有してください。
                        </p>
                        <div className="flex gap-2">
                            <Input
                                readOnly
                                value={`${typeof window !== 'undefined' ? window.location.origin : ''}/apply?event_code=${createdEvent.event_code}`}
                                className="bg-white"
                            />
                            <Button
                                variant="secondary"
                                onClick={() => {
                                    navigator.clipboard.writeText(`${window.location.origin}/apply?event_code=${createdEvent.event_code}`);
                                    alert('コピーしました');
                                }}
                            >
                                <Copy className="w-4 h-4 mr-2" />
                                URLコピー
                            </Button>
                        </div>
                    </div>
                )}
            </section>

            {/* 2. Event List Section */}
            <section className="space-y-4">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <List className="w-5 h-5" />
                        作成済みイベント一覧
                    </h2>
                </div>

                <div className="bg-white rounded-lg shadow border border-border overflow-hidden overflow-x-auto">
                    <table className="w-full text-sm text-left">
                        <thead className="bg-muted/50 text-foreground/70 uppercase text-xs">
                            <tr>
                                <th className="px-6 py-4">作成日</th>
                                <th className="px-6 py-4">コード</th>
                                <th className="px-6 py-4">イベント名</th>
                                <th className="px-6 py-4">スタッフパスコード</th>
                                <th className="px-6 py-4">申し込みURL</th>
                                <th className="px-6 py-4 text-center">操作</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-border">
                            {loading ? (
                                <tr><td colSpan={6} className="p-8 text-center">読み込み中...</td></tr>
                            ) : events.length === 0 ? (
                                <tr><td colSpan={6} className="p-8 text-center text-foreground/50">イベントはまだありません。</td></tr>
                            ) : (
                                events.map(event => (
                                    <tr key={event.id} className="hover:bg-muted/10 transition-colors">
                                        <td className="px-6 py-4 text-foreground/60">
                                            {new Date(event.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 font-mono font-bold text-primary">
                                            {event.event_code}
                                        </td>
                                        <td className="px-6 py-4 font-bold min-w-[200px]">
                                            {event.name}
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2 items-center">
                                                <code className="text-xs bg-yellow-50 border border-yellow-200 px-2 py-1 rounded font-mono font-bold">
                                                    {event.staff_passcode}
                                                </code>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(event.staff_passcode);
                                                        alert('パスコードをコピーしました');
                                                    }}
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex gap-2 items-center">
                                                <code className="text-xs bg-muted px-2 py-1 rounded flex-1 truncate max-w-xs">
                                                    {typeof window !== 'undefined' ? window.location.origin : ''}/apply?event_code={event.event_code}
                                                </code>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => {
                                                        navigator.clipboard.writeText(`${window.location.origin}/apply?event_code=${event.event_code}`);
                                                        alert('URLをコピーしました');
                                                    }}
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </Button>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <Button
                                                variant="secondary"
                                                size="sm"
                                                onClick={() => handleDeleteClick(event)}
                                                className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </section>

            {/* Delete Confirmation Modal */}
            {deleteModal.show && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-lg p-8 max-w-md w-full mx-4 shadow-2xl">
                        <div className="flex items-center gap-3 mb-4">
                            <AlertTriangle className="w-8 h-8 text-red-600" />
                            <h2 className="text-xl font-bold text-red-600">イベント削除の確認</h2>
                        </div>

                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
                            <p className="text-sm text-red-800 font-bold mb-2">
                                ⚠️ この操作は取り消せません
                            </p>
                            <p className="text-sm text-red-700">
                                以下のイベントとすべての関連データが完全に削除されます：
                            </p>
                            <ul className="text-sm text-red-700 mt-2 ml-4 list-disc">
                                <li>イベント情報</li>
                                <li>参加者データ</li>
                                <li>メール送信履歴</li>
                            </ul>
                        </div>

                        <div className="bg-gray-100 rounded-lg p-4 mb-6">
                            <p className="text-sm text-foreground/60 mb-1">削除対象イベント</p>
                            <p className="font-bold text-lg">{deleteModal.event?.name}</p>
                            <p className="text-sm text-foreground/60 mt-1">
                                イベントコード: <span className="font-mono font-bold">{deleteModal.event?.event_code}</span>
                            </p>
                        </div>

                        <div className="flex gap-3">
                            <Button
                                variant="secondary"
                                onClick={() => setDeleteModal({ show: false, event: null })}
                                disabled={deleting}
                                className="flex-1"
                            >
                                キャンセル
                            </Button>
                            <Button
                                onClick={handleDeleteConfirm}
                                disabled={deleting}
                                className="flex-1 bg-red-600 hover:bg-red-700 text-white"
                            >
                                {deleting ? '削除中...' : '削除する'}
                            </Button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
