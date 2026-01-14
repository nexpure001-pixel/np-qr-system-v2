'use server';

import { createClient } from "@/utils/supabase/server";

// Fetch all events for current tenant (Authenticated User)
export async function getEvents() {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 2. Get Tenant for User
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (!tenant) return [];

    // 3. Get Events
    const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Fetch Events Error:', error);
        return [];
    }
    return data;
}

// Create a new event
export async function createEvent(formData: FormData) {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'ログインしてください。' };

    // 2. Get Tenant for User
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (!tenant) return { success: false, error: 'テナントが見つかりません。設定を確認してください。' };

    // Extract Data
    const name = formData.get('name') as string;
    const eventCode = formData.get('event_code') as string;
    const staffPasscode = formData.get('staff_passcode') as string;

    if (!name || !eventCode || !staffPasscode) {
        return { success: false, error: '必須項目が入力されていません。' };
    }

    // Insert Event
    const { data, error } = await supabase
        .from('events')
        .insert({
            tenant_id: tenant.id,
            name,
            event_code: eventCode,
            staff_passcode: staffPasscode
        })
        .select()
        .single();

    if (error) {
        console.error('Create Event Error:', error);
        if (error.code === '23505') {
            return { success: false, error: 'このイベントコードは既に使用されています。' };
        }
        return { success: false, error: 'イベントの作成に失敗しました。' };
    }

    return { success: true, event: data };
}

// Get SMTP Settings for current tenant
export async function getSMTPSettings() {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 2. Get Tenant with SMTP settings
    const { data: tenant } = await supabase
        .from('tenants')
        .select('smtp_host, smtp_port, smtp_user, smtp_password, smtp_from_email')
        .eq('owner_id', user.id)
        .single();

    return tenant;
}

// Update SMTP Settings
export async function updateSMTPSettings(formData: FormData) {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'ログインしてください。' };

    // 2. Get Tenant
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (!tenant) return { success: false, error: 'テナントが見つかりません。' };

    // Extract Data
    const smtpHost = formData.get('smtp_host') as string;
    const smtpPort = parseInt(formData.get('smtp_port') as string);
    const smtpUser = formData.get('smtp_user') as string;
    const smtpPassword = formData.get('smtp_password') as string;
    const smtpFromEmail = formData.get('smtp_from_email') as string;

    if (!smtpHost || !smtpPort || !smtpUser || !smtpPassword || !smtpFromEmail) {
        return { success: false, error: '全ての項目を入力してください。' };
    }

    // Update Tenant SMTP Settings
    const { error } = await supabase
        .from('tenants')
        .update({
            smtp_host: smtpHost,
            smtp_port: smtpPort,
            smtp_user: smtpUser,
            smtp_password: smtpPassword,
            smtp_from_email: smtpFromEmail,
            updated_at: new Date().toISOString()
        })
        .eq('id', tenant.id);

    if (error) {
        console.error('Update SMTP Settings Error:', error);
        return { success: false, error: 'SMTP設定の保存に失敗しました。' };
    }

    return { success: true };
}

// Delete event and all related data
export async function deleteEvent(eventId: string) {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'ログインしてください。' };

    // 2. Get Tenant for User
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (!tenant) return { success: false, error: 'テナントが見つかりません。' };

    // 3. Verify event belongs to tenant
    const { data: event } = await supabase
        .from('events')
        .select('id')
        .eq('id', eventId)
        .eq('tenant_id', tenant.id)
        .single();

    if (!event) return { success: false, error: 'イベントが見つかりません。' };

    // 4. Delete related participations (cascade will handle this, but explicit for clarity)
    await supabase
        .from('participations')
        .delete()
        .eq('event_id', eventId);

    // 5. Delete event (this will cascade delete participations if foreign key is set)
    const { error: deleteError } = await supabase
        .from('events')
        .delete()
        .eq('id', eventId);

    if (deleteError) {
        console.error('Delete Event Error:', deleteError);
        return { success: false, error: 'イベント削除に失敗しました。' };
    }

    return { success: true };
}
