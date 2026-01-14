'use server';

import { createClient } from "@/utils/supabase/server";

// Get all events for the current tenant
export async function getEvents() {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 2. Get Tenant
    const { data: tenant } = await supabase
        .from('tenants')
        .select('id')
        .eq('owner_id', user.id)
        .single();

    if (!tenant) return [];

    // 3. Get Events
    const { data: events } = await supabase
        .from('events')
        .select('id, name, event_code, created_at')
        .eq('tenant_id', tenant.id)
        .order('created_at', { ascending: false });

    return events || [];
}

// Get statistics for a specific event
export async function getEventStats(eventId: string) {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // 2. Verify event belongs to user's tenant
    const { data: event } = await supabase
        .from('events')
        .select(`
            id,
            name,
            event_code,
            tenant_id,
            tenants!inner (
                owner_id
            )
        `)
        .eq('id', eventId)
        .single();

    if (!event) return null;

    const tenantInfo = event.tenants as unknown as { owner_id: string } | { owner_id: string }[];
    const ownerId = Array.isArray(tenantInfo) ? tenantInfo[0]?.owner_id : tenantInfo?.owner_id;

    if (ownerId !== user.id) {
        return null;
    }

    // 3. Get participation statistics
    const { data: participations } = await supabase
        .from('participations')
        .select('status')
        .eq('event_id', eventId);

    if (!participations) {
        return {
            eventName: event.name,
            eventCode: event.event_code,
            total: 0,
            checkedIn: 0,
            pending: 0
        };
    }

    const total = participations.length;
    const checkedIn = participations.filter(p => p.status === 'checked_in').length;
    const pending = participations.filter(p => p.status === 'pending').length;

    return {
        eventName: event.name,
        eventCode: event.event_code,
        total,
        checkedIn,
        pending
    };
}

// Get tenant info (for company code display)
export async function getTenantInfo() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    const { data: tenant } = await supabase
        .from('tenants')
        .select('name, company_code')
        .eq('owner_id', user.id)
        .single();

    return tenant;
}

// Get participants for a specific event with master data match info
export async function getEventParticipants(eventId: string) {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return [];

    // 2. Verify event belongs to user's tenant
    const { data: event } = await supabase
        .from('events')
        .select(`
            id,
            tenant_id,
            tenants!inner (
                owner_id
            )
        `)
        .eq('id', eventId)
        .single();

    if (!event) return [];

    const tenantInfo = event.tenants as unknown as { owner_id: string } | { owner_id: string }[];
    const ownerId = Array.isArray(tenantInfo) ? tenantInfo[0]?.owner_id : tenantInfo?.owner_id;

    if (ownerId !== user.id) {
        return [];
    }

    // 3. Get participations with master data join
    const { data: participations } = await supabase
        .from('participations')
        .select(`
            id,
            name,
            email,
            ticket_type,
            status,
            email_sent,
            created_at,
            master_data_id,
            master_data (
                employee_id,
                name,
                email
            )
        `)
        .eq('event_id', eventId)
        .order('created_at', { ascending: false });

    return participations || [];
}

// Delete a participation record
export async function deleteParticipation(participationId: string) {
    const supabase = await createClient();

    // 1. Get User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: '認証が必要です。' };

    // 2. Verify ownership through participation -> event -> tenant
    const { data: participation, error: findError } = await supabase
        .from('participations')
        .select(`
            id,
            event_id,
            events!inner (
                tenant_id,
                tenants!inner (
                    owner_id
                )
            )
        `)
        .eq('id', participationId)
        .single();

    if (findError || !participation) {
        return { success: false, error: '対象が見つかりません。' };
    }

    const eventData = participation.events as unknown as { tenants: { owner_id: string } };
    const ownerId = eventData?.tenants?.owner_id;

    if (ownerId !== user.id) {
        return { success: false, error: '削除権限がありません。' };
    }

    // 3. Delete
    const { error: deleteError } = await supabase
        .from('participations')
        .delete()
        .eq('id', participationId);

    if (deleteError) {
        console.error('Delete Error:', deleteError);
        return { success: false, error: '削除に失敗しました。' };
    }

    return { success: true };
}
