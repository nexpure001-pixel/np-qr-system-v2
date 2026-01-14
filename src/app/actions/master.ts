'use server';

import { createClient } from "@/utils/supabase/server";

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

    const { data, error } = await supabase
        .from('master_data')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fetch Master Data Error:', error);
        return { data: [], error: error.message, code: error.code };
    }
    return { data: data || [], error: null };
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

    const employeeId = formData.get('employee_id') as string;
    const name = formData.get('name') as string;

    if (!employeeId || !name) {
        return { success: false, error: 'IDと名前は必須です。' };
    }

    // Use Upsert to handle duplicates gracefully
    const { error } = await supabase.from('master_data').upsert({
        tenant_id: tenant.id,
        employee_id: employeeId,
        name: name
    }, { onConflict: 'tenant_id, employee_id' });

    if (error) {
        console.error('Add Record Error:', error);
        return { success: false, error: '保存に失敗しました。', detail: error.message, code: error.code };
    }

    return { success: true };
}

// Bulk Import to company master
export async function importMasterDataCSV(rows: { employee_id: string, name: string }[]) {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
        console.log('importMasterDataCSV: No user found');
        return { success: false, error: 'ログインしてください。' };
    }

    const { data: tenant, error: tenantError } = await supabase.from('tenants').select('id').eq('owner_id', user.id).single();

    if (tenantError || !tenant) {
        console.error('importMasterDataCSV: Tenant lookup failed', tenantError);
        return { success: false, error: 'テナントが見つかりません。', detail: tenantError?.message };
    }

    // Prepare data with tenant_id
    const payload = rows.map(r => ({
        tenant_id: tenant.id,
        employee_id: r.employee_id,
        name: r.name
    }));

    // Get existing employee IDs to filter out duplicates
    const { data: existingRecords } = await supabase
        .from('master_data')
        .select('employee_id')
        .eq('tenant_id', tenant.id);

    const existingIds = new Set(existingRecords?.map(r => r.employee_id) || []);

    // Filter out existing records - only insert new ones
    const newRecords = payload.filter(r => !existingIds.has(r.employee_id));

    if (newRecords.length === 0) {
        return { success: true, message: '新規データがありません。すべて登録済みです。', inserted: 0 };
    }

    // Insert only new records
    const { error } = await supabase.from('master_data').insert(newRecords);

    if (error) {
        console.error('Import Error:', error);
        return { success: false, error: `インポートエラー: ${error.message} (Code: ${error.code})` };
    }

    return { success: true, inserted: newRecords.length, skipped: payload.length - newRecords.length };
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
