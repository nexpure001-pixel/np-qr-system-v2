'use server';

import { validateMasterRows } from "@/utils/masterData";
import { createClient } from "@/utils/supabase/server";

interface MasterDataRecord {
    id: string;
    tenant_id: string;
    employee_id: string;
    name: string;
    email: string | null;
    created_at: string;
}

// Fetch all participants for the company (Authenticated User)
export async function getMasterData() {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        return { data: [], error: 'NOT_LOGGED_IN' };
    }

    // 2. Get Tenant
    const { data: tenant, error: tenantError } = await supabase.from('tenants').select('id, name').eq('owner_id', user.id).single();

    if (tenantError) {
        console.error('getMasterData: Tenant Fetch Error', tenantError);
        return { data: [], error: tenantError.message, code: tenantError.code };
    }

    if (!tenant) {
        console.warn('getMasterData: No tenant linked to user', user.id);
        return { data: [], error: 'TENANT_NOT_FOUND' };
    }

    // Fetch all data in batches to bypass 1000 row limit
    const batchSize = 1000;
    let allData: MasterDataRecord[] = [];
    let offset = 0;
    let hasMore = true;

    while (hasMore) {
        const { data, error } = await supabase
            .from('master_data')
            .select('*')
            .eq('tenant_id', tenant.id)
            .order('created_at', { ascending: false })
            .range(offset, offset + batchSize - 1);

        if (error) {
            console.error('Fetch Master Data Error:', error);
            return { data: allData, error: error.message, code: error.code };
        }

        if (data && data.length > 0) {
            allData = [...allData, ...data];
            offset += batchSize;
            hasMore = data.length === batchSize; // Continue if we got a full batch
        } else {
            hasMore = false;
        }
    }

    return { data: allData, error: null };
}

// Add single participant to company master
export async function addMasterDataRecord(formData: FormData) {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'ログインしてください。' };

    // 2. Get Tenant
    const { data: tenant, error: tErr } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single();
    if (tErr || !tenant) {
        console.error('addMasterDataRecord: Tenant error', tErr);
        return { success: false, error: 'テナントが見つかりません。', detail: tErr?.message };
    }

    const checked = validateMasterRows([{
        employee_id: formData.get('employee_id'), name: formData.get('name'), email: formData.get('email')
    }]);
    if ('error' in checked) return { success: false, error: checked.error };
    const { error } = await supabase.from('master_data').insert({ tenant_id: tenant.id, ...checked.rows[0] });
    if (error) return { success: false, error: error.code === '23505'
        ? 'この会員IDは登録済みです。既存の氏名・メールアドレスは変更していません。'
        : '追加できませんでした。時間をおいて再度お試しください。' };
    return { success: true };
}

// Existing members are preserved. The database unique constraint also handles
// concurrent imports and members beyond PostgREST's default 1,000-row read limit.
export async function importMasterDataCSV(rows: { employee_id: string, name: string, email?: string }[]) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'ログインしてください。' };
    const { data: tenant, error: tenantError } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single();
    if (tenantError || !tenant) return { success: false, error: '主催者情報を取得できませんでした。' };
    const checked = validateMasterRows(rows);
    if ('error' in checked) return { success: false, error: checked.error };
    const { error, count } = await supabase.from('master_data').upsert(
        checked.rows.map(row => ({ tenant_id: tenant.id, ...row })),
        { onConflict: 'tenant_id,employee_id', ignoreDuplicates: true, count: 'exact' }
    );
    if (error) return { success: false, error: 'CSVの追加に失敗しました。会員IDとデータを確認してください。' };
    if (count === null) return { success: false, error: '追加件数を確認できませんでした。名簿を再読み込みして確認してください。' };
    return { success: true, inserted: count, skipped: rows.length - count };
}

// Delete master data record
export async function deleteMasterData(id: string) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'ログインしてください。' };

    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (!tenant) return { success: false, error: 'テナントが見つかりません。' };

    // Verify record belongs to tenant
    const { data: record } = await supabase
        .from('master_data')
        .select('id')
        .eq('id', id)
        .eq('tenant_id', tenant.id)
        .single();

    if (!record) return { success: false, error: 'データが見つかりません。' };

    // Delete record
    const { error } = await supabase
        .from('master_data')
        .delete()
        .eq('id', id);

    if (error) {
        console.error('Delete Error:', error);
        return { success: false, error: '削除に失敗しました。' };
    }

    return { success: true };
}
