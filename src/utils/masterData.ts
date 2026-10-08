type Member = { employee_id: string; name: string; email: string | null };

export function validateMasterRows(input: unknown): { rows: Member[] } | { error: string } {
    if (!Array.isArray(input) || input.length === 0 || input.length > 10000) {
        return { error: '1〜10,000件の会員データを指定してください。' };
    }
    const unique = new Map<string, Member>();
    for (let i = 0; i < input.length; i++) {
        const row = input[i];
        const clean = (value: unknown) => typeof value === 'string' ? value.trim() : '';
        const member = { employee_id: clean(row?.employee_id), name: clean(row?.name), email: clean(row?.email) || null };
        if (!member.employee_id || !member.name || member.employee_id.length > 100 || member.name.length > 200) {
            return { error: `${i + 1}件目の会員ID・氏名を確認してください（IDは100文字、氏名は200文字まで）。` };
        }
        if (member.email && (member.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(member.email))) {
            return { error: `${i + 1}件目のメールアドレスの形式を確認してください。` };
        }
        const prior = unique.get(member.employee_id);
        if (prior && (prior.name !== member.name || prior.email !== member.email)) {
            return { error: `${i + 1}件目の会員IDがCSV内で重複し、氏名またはメールアドレスが異なります。内容を統一してください。` };
        }
        unique.set(member.employee_id, member);
    }
    return { rows: [...unique.values()] };
}
