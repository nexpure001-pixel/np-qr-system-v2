'use server';

import { createClient } from "@/utils/supabase/server";

// Get current user's account information
export async function getAccountInfo() {
    const supabase = await createClient();

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return null;

    // Get tenant info
    const { data: tenant } = await supabase
        .from('tenants')
        .select('name, company_code, created_at')
        .eq('owner_id', user.id)
        .single();

    return {
        email: user.email,
        userId: user.id,
        createdAt: user.created_at,
        lastSignIn: user.last_sign_in_at,
        tenant: tenant
    };
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
