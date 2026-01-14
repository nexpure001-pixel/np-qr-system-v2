'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getEvents } from "@/app/actions/settings";
import { getMasterData } from "@/app/actions/master";
import { parseCSV } from "@/utils/csvParser";
import { Loader2, FileSpreadsheet, CheckCircle, AlertCircle, UserCheck, Users } from 'lucide-react';

interface Event {
    id: string;
    name: string;
    event_code: string;
}

interface MasterData {
    id: string;
    employee_id: string;
    name: string;
    email: string;
}

interface MatchedRow {
    _id: number;
    name: string;
    employeeId: string;
    price: string;
    email: string;
    master_data_id: string | null;
    status: 'member' | 'guest';
}

export default function TicketImportPage() {
    const [events, setEvents] = useState<Event[]>([]);
    const [masterData, setMasterData] = useState<MasterData[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [, setFile] = useState<File | null>(null);

    // Matched data after CSV upload
    const [matchedData, setMatchedData] = useState<MatchedRow[]>([]);
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    const [importing, setImporting] = useState(false);
    const [result, setResult] = useState<{ success: boolean, message: string } | null>(null);

    useEffect(() => {
        getEvents().then(setEvents);
        getMasterData().then(res => {
            if (!res.error) setMasterData(res.data);
        });
    }, []);

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            const f = e.target.files[0];
            setFile(f);

            try {
                const data = await parseCSV(f);
                if (data.length > 0) {
                    // Auto-detect columns (prioritizing ID, Name, Price)
                    const headers = Object.keys(data[0]);
                    let idCol = headers[0], nameCol = headers[1], priceCol = headers[2];

                    // Refine if headers match loose keywords even if order is slightly different
                    headers.forEach(h => {
                        const lowH = h.toLowerCase();
                        if (lowH.includes('id') || lowH.includes('番号') || lowH.includes('コード')) idCol = h;
                        if (lowH.includes('name') || lowH.includes('名前') || lowH.includes('氏名')) nameCol = h;
                        if (lowH.includes('price') || lowH.includes('金額') || lowH.includes('値段') || lowH.includes('product') || lowH.includes('商品')) priceCol = h;
                    });

                    if (!nameCol || !priceCol) {
                        alert('CSVに「氏名」と「値段」の列が必要です。');
                        return;
                    }

                    // Auto-match with master data
                    const matched = data.map((row, index) => {
                        const name = row[nameCol]?.trim() || '';
                        const employeeId = idCol ? row[idCol]?.trim() : '';
                        const price = row[priceCol]?.trim() || '';

                        // Find matching master data
                        const masterMatch = masterData.find(m =>
                            (m.employee_id && employeeId && m.employee_id === employeeId) ||
                            (m.name === name)
                        );

                        return {
                            _id: index,
                            name,
                            employeeId,
                            price,
                            email: masterMatch?.email || '',
                            master_data_id: masterMatch?.id || null,
                            status: (masterMatch ? 'member' : 'guest') as 'member' | 'guest'
                        };
                    });

                    setMatchedData(matched);
                    // Select all by default
                    setSelectedRows(new Set(matched.map((_, i) => i)));
                } else {
                    alert('CSVファイルが空か、読み込めませんでした。');
                }
            } catch (err) {
                console.error(err);
                alert('CSV読み込みエラー');
            }
        }
    };

    const handleRegister = async () => {
        if (!selectedEventId) {
            alert('イベントを選択してください。');
            return;
        }

        if (selectedRows.size === 0) {
            alert('登録する参加者を選択してください。');
            return;
        }

        setImporting(true);
        const targetData = matchedData.filter((_, i) => selectedRows.has(i));

        try {
            // Import to registerParticipants (no email sending)
            const response = await fetch('/api/register-participants', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    eventId: selectedEventId,
                    participants: targetData
                })
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg = 'サーバーエラーが発生しました。';
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.error || errorMsg;
                } catch {
                    errorMsg = errorText || errorMsg;
                }
                setResult({ success: false, message: `エラー: ${errorMsg}` });
                return;
            }

            const res = await response.json();
            if (res.success) {
                setResult({ success: true, message: `${res.count || targetData.length}名の参加者を登録しました。` });
                setMatchedData([]);
                setSelectedRows(new Set());
                setFile(null);
            } else {
                setResult({ success: false, message: res.error || '登録に失敗しました。' });
            }
        } catch (err) {
            const error = err as Error;
            console.error(error);
            setResult({ success: false, message: '登録中にエラーが発生しました。インターネット接続やセッションの有効期限を確認してください。' });
        } finally {
            setImporting(false);
        }
    };

    const toggleRow = (id: number) => {
        const newSet = new Set(selectedRows);
        if (newSet.has(id)) {
            newSet.delete(id);
        } else {
            newSet.add(id);
        }
        setSelectedRows(newSet);
    };

    const toggleAll = () => {
        if (selectedRows.size === matchedData.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(matchedData.map((_, i) => i)));
        }
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-bold text-foreground">チケット一括登録</h1>
                <p className="text-foreground/70 text-sm">購入者CSVをアップロードして参加者を登録します。</p>
            </div>

            {/* Event Selection */}
            <Card className="p-6">
                <label className="block text-sm font-bold text-foreground/70 mb-2">対象イベント</label>
                <select
                    value={selectedEventId}
                    onChange={(e) => setSelectedEventId(e.target.value)}
                    className="w-full md:w-auto px-4 py-3 border border-border rounded-lg font-bold focus:outline-none focus:ring-2 focus:ring-primary"
                >
                    <option value="">イベントを選択</option>
                    {events.map(event => (
                        <option key={event.id} value={event.id}>
                            {event.name} ({event.event_code})
                        </option>
                    ))}
                </select>
            </Card>

            {/* File Upload */}
            <Card className="p-6">
                <div className="flex items-center gap-2 mb-4">
                    <FileSpreadsheet className="w-5 h-5 text-primary" />
                    <h2 className="font-bold">CSVアップロード</h2>
                </div>
                <p className="text-sm text-foreground/60 mb-4">
                    推奨形式: **ID、氏名、値段** の3列（ヘッダーあり）
                </p>
                <input
                    type="file"
                    accept=".csv"
                    onChange={handleFileChange}
                    className="block w-full text-sm text-foreground/70 file:mr-4 file:py-2 file:px-4 file:rounded file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-white hover:file:bg-primary/90"
                />
            </Card>

            {/* Matched Data Preview */}
            {matchedData.length > 0 && (
                <Card className="p-6">
                    <div className="flex items-center justify-between mb-4">
                        <h2 className="font-bold">照合結果 ({matchedData.length}名)</h2>
                        <div className="flex gap-2">
                            <Button size="sm" variant="secondary" onClick={toggleAll}>
                                {selectedRows.size === matchedData.length ? '全て解除' : '全て選択'}
                            </Button>
                        </div>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-muted/50 text-xs uppercase">
                                <tr>
                                    <th className="px-4 py-3 text-left">
                                        <input
                                            type="checkbox"
                                            checked={selectedRows.size === matchedData.length}
                                            onChange={toggleAll}
                                            className="w-4 h-4"
                                        />
                                    </th>
                                    <th className="px-4 py-3 text-left">氏名</th>
                                    <th className="px-4 py-3 text-left">メールアドレス</th>
                                    <th className="px-4 py-3 text-left">値段</th>
                                    <th className="px-4 py-3 text-left">区分</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y">
                                {matchedData.map((row, idx) => (
                                    <tr key={idx} className="hover:bg-muted/10">
                                        <td className="px-4 py-3">
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.has(idx)}
                                                onChange={() => toggleRow(idx)}
                                                className="w-4 h-4"
                                            />
                                        </td>
                                        <td className="px-4 py-3 font-bold">{row.name}</td>
                                        <td className="px-4 py-3 text-foreground/70">{row.email || '-'}</td>
                                        <td className="px-4 py-3">{row.price}</td>
                                        <td className="px-4 py-3">
                                            {row.status === 'member' ? (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-50 text-green-700 rounded text-xs font-bold">
                                                    <UserCheck className="w-3 h-3" />
                                                    会員
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 px-2 py-1 bg-gray-100 text-gray-600 rounded text-xs">
                                                    <Users className="w-3 h-3" />
                                                    ゲスト
                                                </span>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <div className="mt-6 flex justify-end">
                        <Button
                            onClick={handleRegister}
                            disabled={importing || selectedRows.size === 0}
                            className="min-w-[200px]"
                        >
                            {importing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    登録中...
                                </>
                            ) : (
                                <>
                                    <CheckCircle className="w-4 h-4 mr-2" />
                                    {selectedRows.size}名を登録
                                </>
                            )}
                        </Button>
                    </div>
                </Card>
            )}

            {/* Result Message */}
            {result && (
                <Card className={`p-6 ${result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}>
                    <div className="flex items-center gap-2">
                        {result.success ? (
                            <CheckCircle className="w-5 h-5 text-green-600" />
                        ) : (
                            <AlertCircle className="w-5 h-5 text-red-600" />
                        )}
                        <p className={`font-bold ${result.success ? 'text-green-700' : 'text-red-700'}`}>
                            {result.message}
                        </p>
                    </div>
                </Card>
            )}
        </div>
    );
}
