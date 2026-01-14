'use server';

import { createClient } from "@/utils/supabase/server";

export async function checkDatabaseState() {
    const supabase = await createClient();

    // 1. Check current auth user
    const { data: { user } } = await supabase.auth.getUser();

    // 2. Check all tenants
    const { data: tenants, error: tenantError } = await supabase
        .from('tenants')
        .select('*');

    return {
        currentUser: user ? { id: user.id, email: user.email } : null,
        tenants: tenants || [],
        tenantError: tenantError ? tenantError.message : null
    };
}
