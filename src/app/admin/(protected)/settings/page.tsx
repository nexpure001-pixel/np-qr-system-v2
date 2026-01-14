'use client';

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { createEvent, getEvents, deleteEvent, updateEvent } from "@/app/actions/settings";
import { useEffect, useState } from "react";
import { Plus, List, Loader2, Copy, Check, Trash2, AlertTriangle, Settings, X, Save } from "lucide-react";

export default function EventSettingsPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [submitting, setSubmitting] = useState(false);
    const [createdEvent, setCreatedEvent] = useState<any>(null); // To show URL after creation
    const [error, setError] = useState<string | null>(null);
    const [deleteModal, setDeleteModal] = useState<{ show: boolean, event: any | null }>({ show: false, event: null });
    const [deleting, setDeleting] = useState(false);

    // Edit Modal State
    const [editModal, setEditModal] = useState<{ show: boolean, event: any | null }>({ show: false, event: null });
    const [editingTicketRules, setEditingTicketRules] = useState<any[]>([]);
    const [saving, setSaving] = useState(false);

    // Create Form State
    const [createIsPublic, setCreateIsPublic] = useState(true);
    const [newTicketRules, setNewTicketRules] = useState<any[]>([]);

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

    const handleEditClick = (event: any) => {
        setEditingTicketRules(event.ticket_config || []);
        setEditModal({ show: true, event: { ...event } });
    };

    const handleUpdate = async () => {
        if (!editModal.event) return;

        setSaving(true);
        const result = await updateEvent(editModal.event.id, {
            ...editModal.event,
            ticket_config: editingTicketRules
        });

        if (result.success) {
            alert('イベント情報を更新しました。');
            setEditModal({ show: false, event: null });
            fetchEvents();
        } else {
            alert('更新に失敗しました: ' + result.error);
        }
        setSaving(false);
    };

    const handleAddRule = () => {
        setEditingTicketRules([...editingTicketRules, {
            id: crypto.randomUUID(),
            name: '',
            keywords: [],
            startTime: ''
        }]);
    };

    const handleRemoveRule = (index: number) => {
        const newRules = [...editingTicketRules];
        newRules.splice(index, 1);
        setEditingTicketRules(newRules);
    };

    const handleRuleChange = (index: number, field: string, value: any) => {
        const newRules = [...editingTicketRules];
        if (field === 'keywords') {
            // Split by comma and trim
            newRules[index][field] = value.split(',').map((k: string) => k.trim()).filter((k: string) => k);
        } else {
            newRules[index][field] = value;
        }
        setEditingTicketRules(newRules);
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
                    <form id="create-event-form" onSubmit={(e) => {
                        e.preventDefault();
                        const formData = new FormData(e.currentTarget);
                        formData.set('is_public_application', createIsPublic ? 'on' : 'off'); // Explicitly set based on state
                        if (!createIsPublic) {
                            formData.set('ticket_config', JSON.stringify(newTicketRules));
                        }
                        handleCreate(formData);
                    }} className="space-y-6">
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

                        <div className="flex items-center gap-2 p-4 bg-muted/20 rounded-lg border border-border/50">
                            <input
                                type="checkbox"
                                name="is_public_application_checkbox" // dummy name, handled by state
                                id="is_public_application"
                                checked={createIsPublic}
                                onChange={(e) => setCreateIsPublic(e.target.checked)}
                                className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                            />
                            <label htmlFor="is_public_application" className="cursor-pointer select-none">
                                <span className="block font-bold">公開申し込みページを有効にする</span>
                                <span className="text-sm text-foreground/60">
                                    有効にすると、誰でもURLから申し込みが可能になります。
                                    <br />無効（OFF）の場合は、管理画面からのCSVインポートのみで参加者を登録します（招待制）。
                                </span>
                            </label>
                        </div>

                        {/* Ticket Rules for Create Form - Only if Private */}
                        {!createIsPublic && (
                            <section className="space-y-4 border-t pt-4">
                                <div className="flex items-center justify-between border-b pb-2">
                                    <h3 className="font-bold">チケット変換ルール (CSVインポート用)</h3>
                                    <Button size="sm" type="button" variant="secondary" onClick={() => setNewTicketRules([...newTicketRules, { id: crypto.randomUUID(), name: '', keywords: [], startTime: '' }])} className="text-xs">
                                        <Plus className="w-3 h-3 mr-1" />
                                        ルール追加
                                    </Button>
                                </div>
                                <p className="text-sm text-foreground/60">
                                    招待制イベントの場合、インポートするCSVに合わせてチケットルールを設定してください。
                                </p>

                                {newTicketRules.length === 0 ? (
                                    <div className="text-center py-6 bg-muted/10 rounded-lg border border-dashed border-foreground/20 text-foreground/40 text-sm">
                                        ルールが設定されていません。
                                    </div>
                                ) : (
                                    <div className="space-y-4">
                                        {newTicketRules.map((rule, idx) => (
                                            <div key={rule.id} className="p-4 bg-muted/10 rounded-lg border border-border relative group">
                                                <button
                                                    type="button"
                                                    onClick={() => {
                                                        const n = [...newTicketRules];
                                                        n.splice(idx, 1);
                                                        setNewTicketRules(n);
                                                    }}
                                                    className="absolute top-2 right-2 text-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                >
                                                    <X className="w-4 h-4" />
                                                </button>

                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                    <div>
                                                        <label className="text-xs font-bold text-foreground/60 block mb-1">券種名</label>
                                                        <input
                                                            value={rule.name}
                                                            onChange={(e) => {
                                                                const n = [...newTicketRules];
                                                                n[idx].name = e.target.value;
                                                                setNewTicketRules(n);
                                                            }}
                                                            className="w-full text-sm p-2 rounded border border-border"
                                                            placeholder="例: PriorityPass"
                                                        />
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-foreground/60 block mb-1">入場時間</label>
                                                        <input
                                                            value={rule.startTime}
                                                            onChange={(e) => {
                                                                const n = [...newTicketRules];
                                                                n[idx].startTime = e.target.value;
                                                                setNewTicketRules(n);
                                                            }}
                                                            className="w-full text-sm p-2 rounded border border-border"
                                                            placeholder="例: 18:30-19:00"
                                                        />
                                                    </div>
                                                </div>
                                                <div>
                                                    <label className="text-xs font-bold text-foreground/60 block mb-1">キーワード</label>
                                                    <div className="space-y-2">
                                                        {/* Display existing keywords as tags */}
                                                        <div className="flex flex-wrap gap-2">
                                                            {rule.keywords.map((keyword: string, kidx: number) => (
                                                                <span key={kidx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                                                    {keyword}
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const n = [...newTicketRules];
                                                                            n[idx].keywords.splice(kidx, 1);
                                                                            setNewTicketRules(n);
                                                                        }}
                                                                        className="hover:text-red-600"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </span>
                                                            ))}
                                                        </div>
                                                        {/* Add keyword input */}
                                                        <div className="flex gap-2">
                                                            <input
                                                                type="text"
                                                                id={`keyword-input-${idx}`}
                                                                className="flex-1 text-sm p-2 rounded border border-border bg-white"
                                                                placeholder="例: 8800 または 8,800"
                                                                onKeyDown={(e) => {
                                                                    if (e.key === 'Enter') {
                                                                        e.preventDefault();
                                                                        const input = e.currentTarget;
                                                                        const value = input.value.trim();
                                                                        if (value) {
                                                                            const n = [...newTicketRules];
                                                                            n[idx].keywords.push(value);
                                                                            setNewTicketRules(n);
                                                                            input.value = '';
                                                                        }
                                                                    }
                                                                }}
                                                            />
                                                            <Button
                                                                type="button"
                                                                size="sm"
                                                                variant="secondary"
                                                                onClick={() => {
                                                                    const input = document.getElementById(`keyword-input-${idx}`) as HTMLInputElement;
                                                                    const value = input?.value.trim();
                                                                    if (value) {
                                                                        const n = [...newTicketRules];
                                                                        n[idx].keywords.push(value);
                                                                        setNewTicketRules(n);
                                                                        input.value = '';
                                                                    }
                                                                }}
                                                            >
                                                                <Plus className="w-3 h-3" />
                                                            </Button>
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </section>
                        )}

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
                                                {/* Edit Modal */}
                                                {editModal.show && editModal.event && (
                                                    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                                                        <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl my-8">
                                                            <div className="flex items-center justify-between p-6 border-b border-border">
                                                                <h2 className="text-xl font-bold flex items-center gap-2">
                                                                    <Settings className="w-5 h-5 text-foreground/60" />
                                                                    イベント設定変更
                                                                </h2>
                                                                <button
                                                                    onClick={() => setEditModal({ show: false, event: null })}
                                                                    className="text-foreground/40 hover:text-foreground/80"
                                                                >
                                                                    <X className="w-6 h-6" />
                                                                </button>
                                                            </div>

                                                            <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
                                                                {/* Basic Info */}
                                                                <section className="space-y-4">
                                                                    <h3 className="font-bold border-b pb-2">基本情報</h3>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                        <Input
                                                                            label="イベント名"
                                                                            value={editModal.event.name}
                                                                            onChange={(e) => setEditModal({ ...editModal, event: { ...editModal.event, name: e.target.value } })}
                                                                        />
                                                                        <Input
                                                                            label="イベントコード"
                                                                            value={editModal.event.event_code}
                                                                            onChange={(e) => setEditModal({ ...editModal, event: { ...editModal.event, event_code: e.target.value } })}
                                                                        />
                                                                        <Input
                                                                            label="スタッフパスコード"
                                                                            value={editModal.event.staff_passcode}
                                                                            onChange={(e) => setEditModal({ ...editModal, event: { ...editModal.event, staff_passcode: e.target.value } })}
                                                                        />
                                                                    </div>

                                                                    <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-border/50">
                                                                        <input
                                                                            type="checkbox"
                                                                            id="edit_is_public"
                                                                            checked={editModal.event.is_public_application}
                                                                            onChange={(e) => setEditModal({ ...editModal, event: { ...editModal.event, is_public_application: e.target.checked } })}
                                                                            className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                                                                        />
                                                                        <label htmlFor="edit_is_public" className="cursor-pointer select-none">
                                                                            <span className="block font-bold">公開申し込みページを有効にする</span>
                                                                        </label>
                                                                    </div>
                                                                </section>

                                                                {/* Ticket Rules */}
                                                                <section className="space-y-4">
                                                                    <div className="flex items-center justify-between border-b pb-2">
                                                                        <h3 className="font-bold">チケット変換ルール (CSVインポート用)</h3>
                                                                        <Button size="sm" variant="secondary" onClick={handleAddRule} className="text-xs">
                                                                            <Plus className="w-3 h-3 mr-1" />
                                                                            ルール追加
                                                                        </Button>
                                                                    </div>
                                                                    <p className="text-sm text-foreground/60">
                                                                        CSVの「金額」や「商品名」を、システム上の「券種」や「入場時間」に紐付けます。<br />
                                                                        キーワードはカンマ(,)区切りで複数設定できます。
                                                                    </p>

                                                                    {editingTicketRules.length === 0 ? (
                                                                        <div className="text-center py-6 bg-muted/10 rounded-lg border border-dashed border-foreground/20 text-foreground/40 text-sm">
                                                                            ルールが設定されていません。
                                                                        </div>
                                                                    ) : (
                                                                        <div className="space-y-4">
                                                                            {editingTicketRules.map((rule, idx) => (
                                                                                <div key={rule.id} className="p-4 bg-muted/10 rounded-lg border border-border relative group">
                                                                                    <button
                                                                                        onClick={() => handleRemoveRule(idx)}
                                                                                        className="absolute top-2 right-2 text-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                                                    >
                                                                                        <X className="w-4 h-4" />
                                                                                    </button>

                                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                                                        <div>
                                                                                            <label className="text-xs font-bold text-foreground/60 block mb-1">券種名 (Ticket Type)</label>
                                                                                            <input
                                                                                                value={rule.name}
                                                                                                onChange={(e) => handleRuleChange(idx, 'name', e.target.value)}
                                                                                                className="w-full text-sm p-2 rounded border border-border"
                                                                                                placeholder="例: PriorityPass"
                                                                                            />
                                                                                        </div>
                                                                                        <div>
                                                                                            <label className="text-xs font-bold text-foreground/60 block mb-1">入場可能時間 (Start Time)</label>
                                                                                            <input
                                                                                                value={rule.startTime}
                                                                                                onChange={(e) => handleRuleChange(idx, 'startTime', e.target.value)}
                                                                                                className="w-full text-sm p-2 rounded border border-border"
                                                                                                placeholder="例: 18:30-19:00"
                                                                                            />
                                                                                        </div>
                                                                                    </div>
                                                                                    <div>
                                                                                        <label className="text-xs font-bold text-foreground/60 block mb-1">
                                                                                            紐付けキーワード
                                                                                        </label>
                                                                                        <div className="space-y-2">
                                                                                            {/* Display existing keywords as tags */}
                                                                                            <div className="flex flex-wrap gap-2">
                                                                                                {rule.keywords.map((keyword: string, kidx: number) => (
                                                                                                    <span key={kidx} className="inline-flex items-center gap-1 px-2 py-1 bg-blue-50 text-blue-700 rounded text-xs font-medium">
                                                                                                        {keyword}
                                                                                                        <button
                                                                                                            type="button"
                                                                                                            onClick={() => {
                                                                                                                const n = [...editingTicketRules];
                                                                                                                n[idx].keywords.splice(kidx, 1);
                                                                                                                setEditingTicketRules(n);
                                                                                                            }}
                                                                                                            className="hover:text-red-600"
                                                                                                        >
                                                                                                            <X className="w-3 h-3" />
                                                                                                        </button>
                                                                                                    </span>
                                                                                                ))}
                                                                                            </div>
                                                                                            {/* Add keyword input */}
                                                                                            <div className="flex gap-2">
                                                                                                <input
                                                                                                    type="text"
                                                                                                    id={`edit-keyword-input-${idx}`}
                                                                                                    className="flex-1 text-sm p-2 rounded border border-border bg-white"
                                                                                                    placeholder="例: 8800 または 8,800"
                                                                                                    onKeyDown={(e) => {
                                                                                                        if (e.key === 'Enter') {
                                                                                                            e.preventDefault();
                                                                                                            const input = e.currentTarget;
                                                                                                            const value = input.value.trim();
                                                                                                            if (value) {
                                                                                                                const n = [...editingTicketRules];
                                                                                                                n[idx].keywords.push(value);
                                                                                                                setEditingTicketRules(n);
                                                                                                                input.value = '';
                                                                                                            }
                                                                                                        }
                                                                                                    }}
                                                                                                />
                                                                                                <Button
                                                                                                    type="button"
                                                                                                    size="sm"
                                                                                                    variant="secondary"
                                                                                                    onClick={() => {
                                                                                                        const input = document.getElementById(`edit-keyword-input-${idx}`) as HTMLInputElement;
                                                                                                        const value = input?.value.trim();
                                                                                                        if (value) {
                                                                                                            const n = [...editingTicketRules];
                                                                                                            n[idx].keywords.push(value);
                                                                                                            setEditingTicketRules(n);
                                                                                                            input.value = '';
                                                                                                        }
                                                                                                    }}
                                                                                                >
                                                                                                    <Plus className="w-3 h-3" />
                                                                                                </Button>
                                                                                            </div>
                                                                                        </div>
                                                                                    </div>
                                                                                </div>
                                                                            ))}
                                                                        </div>
                                                                    )}
                                                                </section>
                                                            </div>

                                                            <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3 rounded-b-xl">
                                                                <Button
                                                                    variant="secondary"
                                                                    onClick={() => setEditModal({ show: false, event: null })}
                                                                    disabled={saving}
                                                                >
                                                                    キャンセル
                                                                </Button>
                                                                <Button
                                                                    onClick={handleUpdate}
                                                                    disabled={saving}
                                                                    className="min-w-[120px]"
                                                                >
                                                                    {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                                                    保存する
                                                                </Button>
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}

                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-center">
                                            <div className="flex gap-2 justify-center">
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleEditClick(event)}
                                                    className="text-foreground/70 hover:bg-muted"
                                                >
                                                    <Settings className="w-4 h-4 mr-1" />
                                                    設定
                                                </Button>
                                                <Button
                                                    variant="secondary"
                                                    size="sm"
                                                    onClick={() => handleDeleteClick(event)}
                                                    className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </Button>
                                            </div>
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

            {/* Edit Modal */}
            {editModal.show && editModal.event && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4 overflow-y-auto">
                    <div className="bg-white rounded-xl max-w-2xl w-full shadow-2xl my-8">
                        <div className="flex items-center justify-between p-6 border-b border-border">
                            <h2 className="text-xl font-bold flex items-center gap-2">
                                <Settings className="w-5 h-5 text-foreground/60" />
                                イベント設定変更
                            </h2>
                            <button
                                onClick={() => setEditModal({ show: false, event: null })}
                                className="text-foreground/40 hover:text-foreground/80"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="p-6 space-y-8 max-h-[80vh] overflow-y-auto">
                            {/* Basic Info */}
                            <section className="space-y-4">
                                <h3 className="font-bold border-b pb-2">基本情報</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <Input
                                        label="イベント名"
                                        value={editModal.event.name}
                                        onChange={(e) => setEditModal({ ...editModal, event: { ...editModal.event, name: e.target.value } })}
                                    />
                                    <Input
                                        label="イベントコード"
                                        value={editModal.event.event_code}
                                        onChange={(e) => setEditModal({ ...editModal, event: { ...editModal.event, event_code: e.target.value } })}
                                    />
                                    <Input
                                        label="スタッフパスコード"
                                        value={editModal.event.staff_passcode}
                                        onChange={(e) => setEditModal({ ...editModal, event: { ...editModal.event, staff_passcode: e.target.value } })}
                                    />
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-muted/20 rounded-lg border border-border/50">
                                    <input
                                        type="checkbox"
                                        id="edit_is_public"
                                        checked={editModal.event.is_public_application}
                                        onChange={(e) => setEditModal({ ...editModal, event: { ...editModal.event, is_public_application: e.target.checked } })}
                                        className="w-5 h-5 text-primary rounded border-gray-300 focus:ring-primary"
                                    />
                                    <label htmlFor="edit_is_public" className="cursor-pointer select-none">
                                        <span className="block font-bold">公開申し込みページを有効にする</span>
                                    </label>
                                </div>
                            </section>

                            {/* Ticket Rules - Only show if Private Event (Not Public) */}
                            {!editModal.event.is_public_application && (
                                <section className="space-y-4">
                                    <div className="flex items-center justify-between border-b pb-2">
                                        <h3 className="font-bold">チケット変換ルール (CSVインポート用)</h3>
                                        <Button size="sm" variant="secondary" onClick={handleAddRule} className="text-xs">
                                            <Plus className="w-3 h-3 mr-1" />
                                            ルール追加
                                        </Button>
                                    </div>
                                    <p className="text-sm text-foreground/60">
                                        CSVの「金額」や「商品名」を、システム上の「券種」や「入場時間」に紐付けます。<br />
                                        キーワードはカンマ(,)区切りで複数設定できます。
                                    </p>

                                    {editingTicketRules.length === 0 ? (
                                        <div className="text-center py-6 bg-muted/10 rounded-lg border border-dashed border-foreground/20 text-foreground/40 text-sm">
                                            ルールが設定されていません。
                                        </div>
                                    ) : (
                                        <div className="space-y-4">
                                            {editingTicketRules.map((rule, idx) => (
                                                <div key={rule.id} className="p-4 bg-muted/10 rounded-lg border border-border relative group">
                                                    <button
                                                        onClick={() => handleRemoveRule(idx)}
                                                        className="absolute top-2 right-2 text-foreground/30 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>

                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-3">
                                                        <div>
                                                            <label className="text-xs font-bold text-foreground/60 block mb-1">券種名 (Ticket Type)</label>
                                                            <input
                                                                value={rule.name}
                                                                onChange={(e) => handleRuleChange(idx, 'name', e.target.value)}
                                                                className="w-full text-sm p-2 rounded border border-border"
                                                                placeholder="例: PriorityPass"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="text-xs font-bold text-foreground/60 block mb-1">入場可能時間 (Start Time)</label>
                                                            <input
                                                                value={rule.startTime}
                                                                onChange={(e) => handleRuleChange(idx, 'startTime', e.target.value)}
                                                                className="w-full text-sm p-2 rounded border border-border"
                                                                placeholder="例: 18:30-19:00"
                                                            />
                                                        </div>
                                                    </div>
                                                    <div>
                                                        <label className="text-xs font-bold text-foreground/60 block mb-1">
                                                            紐付けキーワード (カンマ区切り)
                                                        </label>
                                                        <input
                                                            value={rule.keywords.join(', ')}
                                                            onChange={(e) => handleRuleChange(idx, 'keywords', e.target.value)}
                                                            className="w-full text-sm p-2 rounded border border-border bg-white"
                                                            placeholder="例: 15400, 8800, VIP"
                                                        />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}
                        </div>

                        <div className="p-6 border-t border-border bg-muted/10 flex justify-end gap-3 rounded-b-xl">
                            <Button
                                variant="secondary"
                                onClick={() => setEditModal({ show: false, event: null })}
                                disabled={saving}
                            >
                                キャンセル
                            </Button>
                            <Button
                                onClick={handleUpdate}
                                disabled={saving}
                                className="min-w-[120px]"
                            >
                                {saving ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Save className="w-4 h-4 mr-2" />}
                                保存する
                            </Button>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
}
