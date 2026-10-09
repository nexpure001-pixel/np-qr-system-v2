"use client";
import { useCallback, useState } from "react";
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Loader2, CheckCircle, Users, Trash2 } from "lucide-react";
interface ParticipantRecord {
    id: string;
    name: string;
    email: string;
    ticket_type: string;
    status: string;
    email_sent: boolean;
    created_at: string;
    master_data_id?: string;
}

export default function ParticipantList({ eventId, mode, initialParticipants, initialTemplate }: { eventId: string; mode: string; initialParticipants: ParticipantRecord[]; initialTemplate: string }) {
    const [participants, setParticipants] = useState<ParticipantRecord[]>(initialParticipants);
    const [loading, setLoading] = useState(false);
    const [sending, setSending] = useState(false);
    const [emailTemplate, setEmailTemplate] = useState(initialTemplate);
    const [savingTemplate, setSavingTemplate] = useState(false);

    const loadParticipants = useCallback(() => {
        if (!eventId) return;

        setLoading(true);
        import('@/app/actions/dashboard').then(({ getEventParticipants }) => {
            getEventParticipants(eventId).then(data => {
                setParticipants(data);
                setLoading(false);
            }).catch(() => { alert('参加者を取得できませんでした。再読み込みしてください。'); }).finally(() => setLoading(false));
        }).catch(() => setLoading(false));

    }, [eventId]);

    const handleSaveTemplate = async () => {
        setSavingTemplate(true);
        try {
            const { updateEvent } = await import('@/app/actions/settings');
            const res = await updateEvent(eventId, { email_template: emailTemplate });
            if (res.success) {
                alert('メールテンプレートを保存しました。');
            } else {
                alert('保存に失敗しました: ' + res.error);
            }
        } catch (error) {
            console.error(error);
            alert('保存中にエラーが発生しました。');
        } finally {
            setSavingTemplate(false);
        }
    };

    const handleBulkEmailSend = async () => {
        if (!confirm('未送信の参加者にQRコードメールを一括送信しますか？')) return;

        setSending(true);
        try {
            const response = await fetch('/api/send-bulk-emails', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ eventId })
            });

            const result = await response.json();
            if (result.success) {
                alert(`${result.count}名にメールを送信しました。`);
                loadParticipants(); // Reload to update email_sent status
            } else {
                alert(`エラー: ${result.error}`);
            }
        } catch (error) {
            console.error(error);
            alert('メール送信中にエラーが発生しました。');
        } finally {
            setSending(false);
        }
    };

    const handleDeleteParticipant = async (id: string, name: string) => {
        if (!confirm(`${name} 様の参加情報を削除しますか？\n（この操作は取り消せません）`)) return;

        try {
            const { deleteParticipation } = await import('@/app/actions/dashboard');
            const res = await deleteParticipation(id);
            if (res.success) {
                loadParticipants();
            } else {
                alert('削除に失敗しました: ' + res.error);
            }
        } catch (error) {
            console.error(error);
            alert('削除中にエラーが発生しました。');
        }
    };

    if (loading) {
        return (
            <Card className="p-6">
                <p className="text-center text-foreground/60">読み込み中...</p>
            </Card>
        );
    }

    if (participants.length === 0) {
        return (
            <Card className="p-6">
                <h3 className="font-bold text-lg mb-4">参加者リスト</h3>
                <p className="text-center text-foreground/60">まだ参加者がいません</p>
            </Card>
        );
    }

    const unsentCount = participants.filter(p => !p.email_sent).length;

    return (
        <Card className="p-6">
            {mode === "mail" && <div className="flex flex-col md:flex-row md:items-end gap-4 mb-6 p-4 bg-secondary border border-border rounded-xl">
                <div className="flex-1">
                    <label htmlFor="email-template" className="block text-sm font-bold text-foreground mb-2 flex items-center gap-2">
                        <span>メール本文への追記（イベント別）</span>
                        <span className="text-[10px] font-normal bg-secondary px-2 py-0.5 rounded text-primary">通知メールの下部に追加されます</span>
                    </label>
                    <textarea id="email-template"
                        value={emailTemplate}
                        onChange={(e) => setEmailTemplate(e.target.value)}
                        placeholder="例: 会場はこちらです https://... お気をつけてお越しください。"
                        className="w-full h-24 p-3 text-sm border border-border rounded-lg focus:ring-2 focus:ring-primary bg-white placeholder:text-foreground/40"
                    />
                </div>
                <div className="flex flex-col gap-2">
                    <Button
                        onClick={handleSaveTemplate}
                        disabled={savingTemplate}
                        className="bg-secondary text-primary hover:bg-blue-200 border-none text-xs h-9"
                    >
                        {savingTemplate ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : '本文を保存'}
                    </Button>
                    <Button
                        onClick={handleBulkEmailSend}
                        disabled={sending || unsentCount === 0}
                        className="bg-primary hover:bg-primary/90 h-10 font-bold whitespace-nowrap"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                送信中...
                            </>
                        ) : (
                            <>
                                メール一括送信 ({unsentCount}名)
                            </>
                        )}
                    </Button>
                </div>
            </div>

            }
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">参加者リスト ({participants.length}名)</h3>
            </div>
            <div className="overflow-x-auto">
                <table className="admin-participant-table w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 text-left">氏名</th>
                            <th className="px-4 py-3 text-left">メール</th>
                            <th className="px-4 py-3 text-left">会員区分</th>
                            <th className="px-4 py-3 text-left">券種</th>
                            <th className="px-4 py-3 text-left">メール状態</th>
                            <th className="px-4 py-3 text-left">入場状態</th>
                            <th className="px-4 py-3 text-right">操作</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {participants.map((p) => (
                            <tr key={p.id} className="hover:bg-muted/10">
                                <td data-label="氏名" className="px-4 py-3 font-bold">{p.name}</td>
                                <td data-label="メール" className="px-4 py-3 text-foreground/70">{p.email}</td>
                                <td data-label="会員区分" className="px-4 py-3">
                                    {p.master_data_id ? (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold">
                                            <CheckCircle className="w-3 h-3" />
                                            会員
                                        </span>
                                    ) : (
                                        <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                            <Users className="w-3 h-3" />
                                            ゲスト
                                        </span>
                                    )}
                                </td>
                                <td data-label="券種" className="px-4 py-3">{p.ticket_type}</td>
                                <td data-label="メール状態" className="px-4 py-3">
                                    {p.email_sent ? (
                                        <span className="text-xs text-green-600 font-bold">送信済み</span>
                                    ) : (
                                        <span className="text-xs text-foreground/40 font-bold">未送信</span>
                                    )}
                                </td>
                                <td data-label="入場状態" className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'checked_in' ? 'bg-green-100 text-green-700' :
                                        p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                        {p.status === 'checked_in' ? '入場済み' :
                                            p.status === 'pending' ? '未入場' : p.status}
                                    </span>
                                </td>
                                <td data-label="操作" className="px-4 py-3 text-right">
                                    <button
                                        onClick={() => handleDeleteParticipant(p.id, p.name || '未登録')}
                                        className="p-2 text-gray-400 hover:text-red-600 transition-colors"
                                        title="削除"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
