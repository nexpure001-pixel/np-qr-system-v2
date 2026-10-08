'use server';

import { isAuthSessionMissingError } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/server";

// Get current user's account information
export async function getAccountInfo() {
    const supabase = await createClient();

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError) {
        const needsLogin = isAuthSessionMissingError(authError)
            || authError.status === 401 || authError.status === 403
            || ['bad_jwt', 'session_not_found', 'session_expired', 'refresh_token_not_found', 'refresh_token_already_used', 'user_not_found'].includes(authError.code || '');
        if (needsLogin) return { status: 'login_required' as const };
        return { status: 'unavailable' as const };
    }
    if (!user) return { status: 'login_required' as const };

    // Get tenant info
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .select('name, company_code, created_at')
        .eq('owner_id', user.id)
        .maybeSingle();

    if (tenantError) return { status: 'unavailable' as const };

    return { status: 'ready' as const, account: {
        email: user.email,
        userId: user.id,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        tenant: tenant
    } };
}

// Update password
export async function updatePassword(newPassword: string) {
    const supabase = await createClient();

    const { error } = await supabase.auth.updateUser({
        password: newPassword
    });

    if (error) {
        return { success: false, error: error.message };
    }

    return { success: true };
}
