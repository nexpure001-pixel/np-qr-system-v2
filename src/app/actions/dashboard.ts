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

    if (!event || (event.tenants as any)?.owner_id !== user.id) {
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
