'use client';

import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { getMasterData, addMasterDataRecord, importMasterDataCSV, deleteMasterData } from "@/app/actions/master";
import { validateMasterRows } from "@/utils/masterData";
import { parseCSV } from "@/utils/csvParser";
import { useEffect, useState, useRef } from "react";
import { Loader2, Plus, Trash2, Upload, AlertCircle, User } from 'lucide-react';

interface MasterRecord {
    id: string;
    employee_id: string;
    name: string;
    email: string | null;
    created_at: string;
}

export default function MasterDataPage() {
    const [data, setData] = useState<MasterRecord[]>([]);
    const [loading, setLoading] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);

    // Pagination State
    const [currentPage, setCurrentPage] = useState(1);
    const itemsPerPage = 100; // Display 100 items per page

    // CSV State
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [isImporting, setIsImporting] = useState(false);
    const [isAdding, setIsAdding] = useState(false);
    const [notice, setNotice] = useState('');
    const [actionError, setActionError] = useState('');

    const [error, setError] = useState<string | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    // Load Master Data (Global for Tenant)
    useEffect(() => {
        setLoading(true);
        getMasterData().then(res => {
            if (res.error) {
                setError(`${res.error} (${res.code || 'UNKNOWN'})`);
            } else {
                setData(res.data);
                setError(null);
            }
            setLoading(false);
        }).catch(() => { setError('名簿を読み込めませんでした。ページを再読み込みしてください。'); setLoading(false); });
    }, [refreshKey]);

    // Handle Manual Add
    const handleAdd = async (formData: FormData) => {
        if (isAdding) return;
        setIsAdding(true); setActionError(''); setNotice('');
        try {
            const result = await addMasterDataRecord(formData);
            if (!result.success) setActionError(result.error || '追加できませんでした。');
            else {
                setNotice('新しい会員を1名追加しました。');
                setCurrentPage(1); setRefreshKey(k => k + 1);
                (document.getElementById('add-form') as HTMLFormElement)?.reset();
            }
        } catch { setActionError('結果を確認できませんでした。名簿を再読み込みして確認してください。'); }
        finally { setIsAdding(false); }
    };

    // Handle Delete
    const handleDelete = async (id: string, name: string) => {
        if (!confirm(`「${name}」を削除しますか？`)) return;

        setDeleting(id);
        const result = await deleteMasterData(id);

        if (result.success) {
            setRefreshKey(k => k + 1); // Refresh list
        } else {
            alert('削除に失敗しました: ' + result.error);
        }

        setDeleting(null);
    };

    // Handle CSV Import
    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true); setActionError(''); setNotice('');
        try {
            const parsedData = await parseCSV(file);

            // Auto-detect columns
            if (parsedData.length === 0) {
                setActionError('データが見つかりません。');
                return;
            }


            const idKey = Object.keys(parsedData[0]).find(k => {
                const h = k.toLowerCase();
                return h.includes('id') || h.includes('社員番号') || h.includes('番号');
            });
            const nameKey = Object.keys(parsedData[0]).find(k => {
                const h = k.toLowerCase();
                return h.includes('name') || h.includes('氏名') || h.includes('名前');
            });
            const emailKey = Object.keys(parsedData[0]).find(k => {
                const h = k.toLowerCase();
                return h.includes('email') || h.includes('mail') || h.includes('メール');
            });

            if (!idKey || !nameKey) {
                setActionError('CSVに「会員ID」と「氏名」の列が必要です。');
                return;
            }

            const formattedData = parsedData.map(row => ({
                employee_id: row[idKey],
                name: row[nameKey],
                email: emailKey ? row[emailKey] : undefined
            }));
            const checked = validateMasterRows(formattedData);
            if ('error' in checked) { setActionError(checked.error); return; }
            if (!confirm(`${file.name}（${formattedData.length}件）から新しい会員だけ追加します。登録済みの会員IDはスキップし、氏名・メールアドレスは上書きしません。追加しますか？`)) return;

            const result = await importMasterDataCSV(formattedData);
            if (result.success) {
                setNotice(`新規追加 ${result.inserted}件 ／ 登録済み・CSV内の重複でスキップ ${result.skipped}件。既存会員の情報は変更していません。`);
                setCurrentPage(1);
                setRefreshKey(k => k + 1);
            } else {
                setActionError(result.error || '追加できませんでした。');
            }
        } catch (err) {
            const error = err as Error;
            setActionError('CSV読み込みエラー: ' + error.message);
        } finally {
            setIsImporting(false);
            if (fileInputRef.current) fileInputRef.current.value = '';
        }
    };

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-foreground">会員名簿管理</h1>
                    <p className="text-foreground/70 text-sm">
                        会員ID・氏名・メールアドレスを登録します。すべてのイベントで共通利用する名簿です。
                    </p>
                </div>

                <div className="flex gap-2">
                    <input
                        type="file"
                        ref={fileInputRef}
                        accept=".csv"
                        className="hidden"
                        onChange={handleFileChange}
                    />
                    <Button
                        variant="secondary"
                        onClick={() => fileInputRef.current?.click()}
                        disabled={isImporting || isAdding}
                    >
                        {isImporting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <Upload className="w-4 h-4 mr-2" />}
                        CSVで新しい会員を追加
                    </Button>
                </div>
            </div>

            <div className="admin-panel space-y-2 text-sm">
                <p>追加分だけのCSVでも、登録済み会員を含む全件CSVでも取り込めます。同じ会員IDはスキップし、既存の氏名・メールアドレスは上書きしません。</p>
                <p>CSVの列：会員ID・氏名・メールアドレス。メールアドレスが空欄でも登録できますが、チケット配信には必要です。</p>
                <a className="underline text-primary" download="会員名簿テンプレート.csv" href={'data:text/csv;charset=utf-8,' + encodeURIComponent('\uFEFF会員ID,氏名,メールアドレス\r\n')}>CSVテンプレートをダウンロード</a>
            </div>
            {notice && <p role="status" className="admin-panel text-green-800">{notice}</p>}
            {actionError && <p role="alert" className="admin-panel text-red-700">{actionError}</p>}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Left: Add Form */}
                <Card className="p-6 md:col-span-1 h-fit">
                    <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                        <Plus className="w-5 h-5 text-primary" />
                        新しい会員を追加
                    </h2>
                    <form id="add-form" action={handleAdd} className="space-y-4">
                        <Input name="employee_id" label="会員ID (必須)" placeholder="例：12345678" required />
                        <Input name="name" label="氏名 (必須)" placeholder="山田 太郎" required />
                        <Input name="email" label="メールアドレス" type="email" placeholder="yamada@example.com" />
                        <Button type="submit" className="w-full" disabled={isAdding || isImporting}>
                            {isAdding ? <Loader2 className="animate-spin w-4 h-4" /> : "追加する"}
                        </Button>
                    </form>
                </Card>

                {/* Right: List */}
                <Card className="md:col-span-2 overflow-hidden">
                    {error && (
                        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm flex items-center gap-2">
                            <AlertCircle className="w-4 h-4 text-red-500" />
                            <span>エラーが発生しました: {error}。データが取得できません。</span>
                        </div>
                    )}

                    <div className="p-6 border-b border-border bg-muted/20 flex justify-between items-center">
                        <h2 className="font-bold flex items-center gap-2">
                            <User className="w-5 h-5" />
                            登録済み会員リスト ({data.length}名)
                        </h2>
                    </div>

                    <div className="overflow-x-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-foreground/50 uppercase bg-muted/50">
                                <tr>
                                    <th className="px-6 py-3">ID</th>
                                    <th className="px-6 py-3">氏名</th>
                                    <th className="px-6 py-3">メール</th>
                                    <th className="px-6 py-3 text-right">登録日</th>
                                    <th className="px-6 py-3 text-center">操作</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-border">
                                {loading && data.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center">読み込み中...</td></tr>
                                ) : data.length === 0 ? (
                                    <tr><td colSpan={5} className="p-8 text-center text-foreground/50">データがありません。</td></tr>
                                ) : (
                                    (() => {
                                        const startIndex = (currentPage - 1) * itemsPerPage;
                                        const endIndex = startIndex + itemsPerPage;
                                        const currentData = data.slice(startIndex, endIndex);

                                        return currentData.map((item) => (
                                            <tr key={item.id} className="bg-white hover:bg-muted/10">
                                                <td className="px-6 py-4 font-mono font-medium">{item.employee_id}</td>
                                                <td className="px-6 py-4">{item.name}</td>
                                                <td className="px-6 py-4 text-sm text-foreground/60">{item.email || '-'}</td>
                                                <td className="px-6 py-4 text-right text-xs text-foreground/50">
                                                    {new Date(item.created_at).toLocaleDateString()}
                                                </td>
                                                <td className="px-6 py-4 text-center">
                                                    <Button
                                                        variant="secondary"
                                                        size="sm"
                                                        onClick={() => handleDelete(item.id, item.name)}
                                                        disabled={deleting === item.id}
                                                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                                    >
                                                        {deleting === item.id ? (
                                                            <Loader2 className="w-4 h-4 animate-spin" />
                                                        ) : (
                                                            <Trash2 className="w-4 h-4" />
                                                        )}
                                                    </Button>
                                                </td>
                                            </tr>
                                        ));
                                    })()
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Controls */}
                    {data.length > itemsPerPage && (
                        <div className="p-4 border-t border-border bg-muted/10 flex justify-between items-center">
                            <div className="text-sm text-foreground/60">
                                {((currentPage - 1) * itemsPerPage) + 1} - {Math.min(currentPage * itemsPerPage, data.length)} 件 / 全 {data.length} 件
                            </div>
                            <div className="flex gap-2">
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                                    disabled={currentPage === 1}
                                >
                                    前へ
                                </Button>
                                <div className="flex items-center gap-2 px-3 text-sm font-bold">
                                    {currentPage} / {Math.ceil(data.length / itemsPerPage)}
                                </div>
                                <Button
                                    variant="secondary"
                                    size="sm"
                                    onClick={() => setCurrentPage(p => Math.min(Math.ceil(data.length / itemsPerPage), p + 1))}
                                    disabled={currentPage >= Math.ceil(data.length / itemsPerPage)}
                                >
                                    次へ
                                </Button>
                            </div>
                        </div>
                    )}
                </Card>
            </div>
        </div>
    );
}


