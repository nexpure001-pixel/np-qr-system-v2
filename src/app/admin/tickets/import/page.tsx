'use client';

import { useState, useEffect } from 'react';
import { Card } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { getEvents } from "@/app/actions/settings";
import { importTickets } from "@/app/actions/tickets";
import { getMasterData } from "@/app/actions/master";
import { parseCSV } from "@/utils/csvParser";
import { Loader2, Upload, FileSpreadsheet, ArrowRight, CheckCircle, AlertCircle, UserCheck, User } from 'lucide-react';

export default function TicketImportPage() {
    const [events, setEvents] = useState<any[]>([]);
    const [masterData, setMasterData] = useState<any[]>([]);
    const [selectedEventId, setSelectedEventId] = useState<string>('');
    const [file, setFile] = useState<File | null>(null);
    const [csvData, setCsvData] = useState<Record<string, string>[]>([]);
    const [originalHeaders, setOriginalHeaders] = useState<string[]>([]);

    // Column Mappings
    const [mappings, setMappings] = useState({
        name: '',
        email: '',
        orderId: '',
        keyword: '' // The column used to match against Ticket Rules (e.g., Product Name or Price)
    });

    // Preview
    const [previewData, setPreviewData] = useState<any[]>([]);
    // Selection state for checkboxes
    const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());

    const [step, setStep] = useState<1 | 2 | 3>(1); // 1: Select/Upload, 2: Map, 3: Preview/Confirm
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
                    setCsvData(data);
                    setOriginalHeaders(Object.keys(data[0]));
                    setStep(2); // Move to mapping

                    // Auto-guess mappings
                    const headers = Object.keys(data[0]);
                    const newMappings = { ...mappings };

                    headers.forEach(h => {
                        const lowH = h.toLowerCase();
                        if (lowH.includes('name') || lowH.includes('名前') || lowH.includes('氏名')) newMappings.name = h;
                        if (lowH.includes('email') || lowH.includes('mail') || lowH.includes('メール')) newMappings.email = h;
                        if (lowH.includes('id') || lowH.includes('番号') || lowH.includes('コード')) newMappings.orderId = h;
                        if (lowH.includes('product') || lowH.includes('商品') || lowH.includes('price') || lowH.includes('金額')) newMappings.keyword = h;
                    });
                    setMappings(newMappings);
                } else {
                    alert('CSVファイルが空か、読み込めませんでした。');
                }
            } catch (err) {
                console.error(err);
                alert('CSV読み込みエラー');
            }
        }
    };

    const handleMappingSubmit = () => {
        if (!selectedEventId) {
            alert('イベントを選択してください。');
            return;
        }
        if (!mappings.name || !mappings.email) {
            alert('「氏名」と「メールアドレス」のカラム指定は必須です。');
            return;
        }

        const event = events.find(e => e.id === selectedEventId);
        const rules = event?.ticket_config || [];

        // Generate Preview Data
        const mapped = csvData.map((row, index) => {
            const keywordValue = mappings.keyword ? row[mappings.keyword] : '';
            const email = row[mappings.email]?.trim() || '';
            const name = row[mappings.name]?.trim() || '';

            // Match Logic: Check against Master Data
            const matchedMaster = masterData.find(m =>
                (m.employee_id && row[mappings.orderId] === m.employee_id) || // ID Match if mapped
                (m.name === name) // Name Match
                // Email match requires email in master data which we might not have in basic master_data table, usually master_data is id+name?
                // Actually master_data table structure: id, tenant_id, employee_id, name, created_at. No email?
                // Wait, if master data doesn't have email, we can't match by email.
                // We match by Name or Employee ID (if orderID is used for ID).
            );

            // Ticket Rule Match
            let matchedRule = null;
            if (keywordValue) {
                matchedRule = rules.find((r: any) =>
                    r.keywords.some((k: string) => keywordValue.includes(k))
                );
            }

            // Fallback or Default
            const ticketType = matchedRule ? matchedRule.name : '一般 (Standard)';
            const startTime = matchedRule ? matchedRule.start_time || matchedRule.startTime : '';

            return {
                _id: index,
                name: name,
                email: email,
                order_id: mappings.orderId ? row[mappings.orderId] : '',
                product_name: keywordValue,
                ticket_type: ticketType,
                start_time: startTime,
                status: matchedMaster ? 'member' : 'guest',
                master_data: matchedMaster || null,
                master_data_id: matchedMaster?.id || null,
            };
        });

        setPreviewData(mapped);
        // Select all by default
        setSelectedRows(new Set(mapped.map(m => m._id)));
        setStep(3);
    };

    const toggleSelectAll = () => {
        if (selectedRows.size === previewData.length) {
            setSelectedRows(new Set());
        } else {
            setSelectedRows(new Set(previewData.map(m => m._id)));
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

    const handleImport = async () => {
        if (selectedRows.size === 0) {
            alert('送信対象が選択されていません。');
            return;
        }

        if (!confirm(`${selectedRows.size}名の参加者にメールを送信しますか？`)) {
            return;
        }

        setImporting(true);
        // Filter only selected rows
        const targetData = previewData.filter(d => selectedRows.has(d._id));

        const res = await importTickets(selectedEventId, targetData);
        if (res.success) {
            setResult({ success: true, message: `${res.count}件のチケットを取り込み、招待メールの送信キューに追加しました。` });
            setStep(1);
            setFile(null);
            setCsvData([]);
            setPreviewData([]);
        } else {
            setResult({ success: false, message: res.error || 'エラーが発生しました。' });
        }
        setImporting(false);
    };

    if (result) {
        return (
            <div className="max-w-2xl mx-auto p-12 text-center space-y-6">
                <div className={`mx-auto w-20 h-20 rounded-full flex items-center justify-center ${result.success ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                    {result.success ? <CheckCircle className="w-10 h-10" /> : <AlertCircle className="w-10 h-10" />}
                </div>
                <h2 className="text-2xl font-bold">{result.success ? 'インポート完了' : 'インポート失敗'}</h2>
                <p className="text-foreground/70">{result.message}</p>
                <Button onClick={() => setResult(null)}>続けてインポートする</Button>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-5xl mx-auto">
            <div>
                <h1 className="text-2xl font-bold flex items-center gap-2">
                    <FileSpreadsheet className="w-6 h-6 text-primary" />
                    チケット一括登録 (CSVインポート)
                </h1>
                <p className="text-foreground/70 text-sm mt-1">
                    ECサイトの注文データなどのCSVを取り込み、名簿と照合してチケットを発行・メール送信します。
                </p>
            </div>

            {/* Stepper */}
            <div className="flex items-center gap-4 text-sm font-bold text-foreground/40">
                <span className={step >= 1 ? "text-primary" : ""}>1. ファイル選択</span>
                <ArrowRight className="w-4 h-4" />
                <span className={step >= 2 ? "text-primary" : ""}>2. データ紐付け</span>
                <ArrowRight className="w-4 h-4" />
                <span className={step >= 3 ? "text-primary" : ""}>3. 照合・送信選択</span>
            </div>

            {step === 1 && (
                <Card className="p-8 space-y-8">
                    <div className="space-y-2">
                        <label className="block text-sm font-bold">対象イベント</label>
                        <select
                            className="w-full p-3 border rounded-lg bg-white"
                            value={selectedEventId}
                            onChange={(e) => setSelectedEventId(e.target.value)}
                        >
                            <option value="">イベントを選択してください</option>
                            {events.map(e => (
                                <option key={e.id} value={e.id}>{e.name} ({e.event_code})</option>
                            ))}
                        </select>
                    </div>

                    <div className="border-2 border-dashed border-border rounded-xl p-12 text-center hover:bg-muted/5 transition-colors cursor-pointer relative">
                        <input
                            type="file"
                            accept=".csv"
                            onChange={handleFileChange}
                            className="absolute inset-0 opacity-0 cursor-pointer"
                        />
                        <Upload className="w-12 h-12 text-foreground/20 mx-auto mb-4" />
                        <h3 className="font-bold text-lg mb-1">CSVファイルをドロップ または 選択</h3>
                        <p className="text-sm text-foreground/50">対応フォーマット: .csv</p>
                    </div>
                </Card>
            )}

            {step === 2 && (
                <Card className="p-8 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-bold mb-2">氏名 (Name) <span className="text-red-500">*</span></label>
                            <select
                                className="w-full p-2 border rounded"
                                value={mappings.name}
                                onChange={(e) => setMappings({ ...mappings, name: e.target.value })}
                            >
                                <option value="">選択してください</option>
                                {originalHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                            <p className="text-xs text-foreground/50 mt-1">※この項目でマスターデータの氏名と照合します</p>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">メールアドレス (Email) <span className="text-red-500">*</span></label>
                            <select
                                className="w-full p-2 border rounded"
                                value={mappings.email}
                                onChange={(e) => setMappings({ ...mappings, email: e.target.value })}
                            >
                                <option value="">選択してください</option>
                                {originalHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">注文番号 / ID (Verification Code)</label>
                            <select
                                className="w-full p-2 border rounded"
                                value={mappings.orderId}
                                onChange={(e) => setMappings({ ...mappings, orderId: e.target.value })}
                            >
                                <option value="">(使用しない)</option>
                                {originalHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold mb-2">判定用キーワード (商品名/金額など)</label>
                            <p className="text-xs text-foreground/50 mb-2">この項目の内容とイベント設定の「キーワード」を照合して、チケット種類を決定します。</p>
                            <select
                                className="w-full p-2 border rounded"
                                value={mappings.keyword}
                                onChange={(e) => setMappings({ ...mappings, keyword: e.target.value })}
                            >
                                <option value="">(使用しない / 全てStandard)</option>
                                {originalHeaders.map(h => <option key={h} value={h}>{h}</option>)}
                            </select>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => { setStep(1); setFile(null); }}>キャンセル</Button>
                        <Button onClick={handleMappingSubmit}>
                            照合・プレビューへ進む <ArrowRight className="w-4 h-4 ml-2" />
                        </Button>
                    </div>
                </Card>
            )}

            {step === 3 && (
                <div className="space-y-6">
                    <Card className="p-6">
                        <div className="flex items-center justify-between mb-4">
                            <div>
                                <h3 className="font-bold">インポートデータ確認 ({previewData.length}件)</h3>
                                <div className="text-sm text-foreground/60">
                                    名簿との照合結果です。送信する対象を選択してください。
                                </div>
                            </div>
                            <div className="flex items-center gap-4 bg-muted/20 px-4 py-2 rounded-lg">
                                <div className="text-sm">
                                    送信対象: <span className="font-bold text-primary text-lg">{selectedRows.size}</span> 件
                                </div>
                            </div>
                        </div>

                        <div className="overflow-x-auto border rounded-lg max-h-[500px] overflow-y-auto">
                            <table className="w-full text-sm text-left relative">
                                <thead className="bg-muted text-xs uppercase sticky top-0 z-10">
                                    <tr>
                                        <th className="px-4 py-3 w-10 text-center">
                                            <input
                                                type="checkbox"
                                                checked={selectedRows.size > 0 && selectedRows.size === previewData.length}
                                                onChange={toggleSelectAll}
                                                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary"
                                            />
                                        </th>
                                        <th className="px-4 py-3">マッチング状況</th>
                                        <th className="px-4 py-3">氏名</th>
                                        <th className="px-4 py-3">メール送信先</th>
                                        <th className="px-4 py-3">判定元データ</th>
                                        <th className="px-4 py-3">割り当てチケット</th>
                                        <th className="px-4 py-3">入場時間</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y bg-white">
                                    {previewData.map((row) => (
                                        <tr
                                            key={row._id}
                                            className={`hover:bg-muted/10 transition-colors ${selectedRows.has(row._id) ? 'bg-primary/5' : ''}`}
                                            onClick={() => toggleRow(row._id)}
                                        >
                                            <td className="px-4 py-3 text-center" onClick={(e) => e.stopPropagation()}>
                                                <input
                                                    type="checkbox"
                                                    checked={selectedRows.has(row._id)}
                                                    onChange={() => toggleRow(row._id)}
                                                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                                                />
                                            </td>
                                            <td className="px-4 py-3">
                                                {row.status === 'member' ? (
                                                    <div className="flex items-center gap-2 text-green-600 font-bold bg-green-50 px-2 py-1 rounded-md w-fit">
                                                        <UserCheck className="w-4 h-4" />
                                                        <span>会員一致</span>
                                                        <span className="text-xs opacity-70 font-mono ml-1">({row.master_data?.employee_id})</span>
                                                    </div>
                                                ) : (
                                                    <div className="flex items-center gap-2 text-gray-500 bg-gray-100 px-2 py-1 rounded-md w-fit">
                                                        <User className="w-4 h-4" />
                                                        <span>ゲスト</span>
                                                    </div>
                                                )}
                                            </td>
                                            <td className="px-4 py-3 font-bold">{row.name}</td>
                                            <td className="px-4 py-3 text-foreground/70">{row.email}</td>
                                            <td className="px-4 py-3 text-xs text-foreground/50 truncate max-w-[150px]">{row.product_name}</td>
                                            <td className="px-4 py-3">
                                                <span className={`px-2 py-1 rounded text-xs font-bold ${row.ticket_type === 'Standard' ? 'bg-gray-100' : 'bg-blue-50 text-blue-700'}`}>
                                                    {row.ticket_type}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs">{row.start_time}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </Card>

                    <div className="flex justify-end gap-3 pt-4">
                        <Button variant="secondary" onClick={() => setStep(2)} disabled={importing}>
                            戻る
                        </Button>
                        <Button
                            onClick={handleImport}
                            disabled={importing || selectedRows.size === 0}
                            className="bg-primary hover:bg-primary/90 text-white min-w-[250px] shadow-lg"
                        >
                            {importing ? <Loader2 className="animate-spin w-4 h-4 mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                            {selectedRows.size}件を登録して送信
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
