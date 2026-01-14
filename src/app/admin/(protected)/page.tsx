'use client';

import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Users, CheckCircle, Clock, Calendar, Loader2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { getEvents, getEventStats } from "@/app/actions/dashboard";
import { isSuperAdmin } from "@/app/actions/super-admin";
import { useRouter } from "next/navigation";

export default function AdminDashboard() {
    const router = useRouter();
    const [events, setEvents] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [stats, setStats] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    // Check if super admin and redirect
    useEffect(() => {
        isSuperAdmin().then(isAdmin => {
            if (isAdmin) {
                router.push('/admin/super/tenants');
            }
        });
    }, [router]);

    useEffect(() => {
        getEvents().then(data => {
            setEvents(data);
            if (data.length > 0) {
                setSelectedEventId(data[0].id);
            }
            setLoading(false);
        });
    }, []);

    useEffect(() => {
        if (selectedEventId) {
            getEventStats(selectedEventId).then(data => {
                setStats(data);
            });
        }
    }, [selectedEventId]);

    return (
        <div className="space-y-8">
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-foreground">
                    イベントダッシュボード
                </h1>
                <div className="flex gap-3">
                    <Link
                        href="/admin/tickets/import"
                        className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-bold hover:bg-secondary transition-colors"
                    >
                        チケット取り込み
                    </Link>
                    <Link
                        href="/admin/master"
                        className="px-4 py-2 bg-white border border-border rounded-lg text-sm font-bold hover:bg-secondary transition-colors"
                    >
                        名簿管理
                    </Link>
                    <Link
                        href="/admin/settings"
                        className="px-4 py-2 bg-primary text-white rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors"
                    >
                        イベント設定
                    </Link>
                </div>
            </div>

            {/* Event Selector */}
            {loading ? (
                <div className="text-center py-8">読み込み中...</div>
            ) : events.length === 0 ? (
                <Card className="p-8 text-center">
                    <p className="text-foreground/60 mb-4">イベントがまだ作成されていません。</p>
                    <Link
                        href="/admin/settings"
                        className="inline-block px-6 py-3 bg-primary text-white rounded-lg font-bold hover:bg-primary/90 transition-colors"
                    >
                        最初のイベントを作成する
                    </Link>
                </Card>
            ) : (
                <>
                    <Card className="p-6">
                        <label className="block text-sm font-bold text-foreground/70 mb-2">
                            イベント選択
                        </label>
                        <select
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                            className="w-full md:w-auto px-4 py-3 border border-border rounded-lg font-bold text-lg focus:outline-none focus:ring-2 focus:ring-primary"
                        >
                            {events.map(event => (
                                <option key={event.id} value={event.id}>
                                    {event.name} ({event.event_code})
                                </option>
                            ))}
                        </select>
                    </Card>

                    {/* Stats Grid - DEMO DATA */}
                    {stats && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <StatsCard
                                title="総申し込み数"
                                value={stats.total.toString()}
                                icon={<Users className="w-6 h-6 text-blue-500" />}
                                subtext="Total Participants"
                            />
                            <StatsCard
                                title="チェックイン済み"
                                value={stats.checkedIn.toString()}
                                icon={<CheckCircle className="w-6 h-6 text-green-500" />}
                                subtext={stats.total > 0 ? `来場率 ${Math.round((stats.checkedIn / stats.total) * 100)}%` : ''}
                            />
                            <StatsCard
                                title="未チェックイン"
                                value={stats.pending.toString()}
                                icon={<Clock className="w-6 h-6 text-orange-500" />}
                                subtext="Pending Check-in"
                            />
                        </div>
                    )}

                    {/* Event Info */}
                    {stats && (
                        <Card className="p-6">
                            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                                <Calendar className="w-5 h-5 text-primary" />
                                イベント情報
                            </h3>
                            <div className="space-y-2 text-sm">
                                <div className="flex justify-between">
                                    <span className="text-foreground/60">イベント名:</span>
                                    <span className="font-bold">{stats.eventName}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-foreground/60">イベントコード:</span>
                                    <span className="font-mono font-bold text-primary">{stats.eventCode}</span>
                                </div>
                            </div>
                        </Card>
                    )}

                    {/* Participant List */}
                    <ParticipantList eventId={selectedEventId} />
                </>
            )}
        </div>
    );
}

function StatsCard({
    title,
    value,
    icon,
    subtext,
}: {
    title: string;
    value: string;
    icon: React.ReactNode;
    subtext?: string;
}) {
    return (
        <Card className="flex flex-col gap-2">
            <div className="flex items-start justify-between">
                <span className="text-sm font-bold text-foreground/60">{title}</span>
                <div className="p-2 bg-white rounded-full shadow-sm">{icon}</div>
            </div>
            <div className="text-3xl font-bold tracking-tight">{value}</div>
            {subtext && (
                <div className="text-xs font-medium text-foreground/50 mt-1">
                    {subtext}
                </div>
            )}
        </Card>
    );
}


function ParticipantList({ eventId }: { eventId: string }) {
    const [participants, setParticipants] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);

    const loadParticipants = useCallback(() => {
        if (!eventId) return;

        setLoading(true);
        import('@/app/actions/dashboard').then(({ getEventParticipants }) => {
            getEventParticipants(eventId).then(data => {
                setParticipants(data);
                setLoading(false);
            });
        });
    }, [eventId]);

    useEffect(() => {
        loadParticipants();
    }, [loadParticipants]);

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
            <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-lg">参加者リスト ({participants.length}名)</h3>
                {unsentCount > 0 && (
                    <Button
                        onClick={handleBulkEmailSend}
                        disabled={sending}
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        {sending ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                送信中...
                            </>
                        ) : (
                            <>
                                📧 メール一括送信 ({unsentCount}名)
                            </>
                        )}
                    </Button>
                )}
            </div>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">
                    <thead className="bg-muted/50 text-xs uppercase">
                        <tr>
                            <th className="px-4 py-3 text-left">氏名</th>
                            <th className="px-4 py-3 text-left">メール</th>
                            <th className="px-4 py-3 text-left">会員区分</th>
                            <th className="px-4 py-3 text-left">券種</th>
                            <th className="px-4 py-3 text-left">メール状態</th>
                            <th className="px-4 py-3 text-left">入場状態</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y">
                        {participants.map((p) => (
                            <tr key={p.id} className="hover:bg-muted/10">
                                <td className="px-4 py-3 font-bold">{p.name}</td>
                                <td className="px-4 py-3 text-foreground/70">{p.email}</td>
                                <td className="px-4 py-3">
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
                                <td className="px-4 py-3">{p.ticket_type}</td>
                                <td className="px-4 py-3">
                                    {p.email_sent ? (
                                        <span className="text-xs text-green-600 font-bold">送信済み</span>
                                    ) : (
                                        <span className="text-xs text-foreground/40 font-bold">未送信</span>
                                    )}
                                </td>
                                <td className="px-4 py-3">
                                    <span className={`px-2 py-1 rounded text-xs font-bold ${p.status === 'checked_in' ? 'bg-green-100 text-green-700' :
                                        p.status === 'pending' ? 'bg-yellow-100 text-yellow-700' :
                                            'bg-gray-100 text-gray-700'
                                        }`}>
                                        {p.status === 'checked_in' ? '入場済み' :
                                            p.status === 'pending' ? '未入場' : p.status}
                                    </span>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </Card>
    );
}
