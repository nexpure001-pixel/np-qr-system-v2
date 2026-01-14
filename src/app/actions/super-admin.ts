'use server';

import { createClient } from "@/utils/supabase/server";
import { createClient as createServiceClient } from '@supabase/supabase-js';

// Generate random company code (5-6 digits)
function generateCompanyCode(): string {
    const length = Math.random() > 0.5 ? 5 : 6;
    return Math.floor(Math.random() * Math.pow(10, length)).toString().padStart(length, '0');
}

// Generate random password (8 characters, alphanumeric)
function generatePassword(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
    let password = '';
    for (let i = 0; i < 8; i++) {
        password += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return password;
}

// Check if current user is super admin
export async function isSuperAdmin() {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) return false;

    const superAdminEmail = process.env.SUPER_ADMIN_EMAIL;
    return user.email === superAdminEmail;
}

// Create new tenant account
export async function createTenantAccount(formData: FormData) {
    // 1. Check super admin permission
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: '権限がありません。' };
    }

    const companyName = formData.get('company_name') as string;
    const companyCode = formData.get('company_code') as string;
    const email = formData.get('email') as string;

    if (!companyName || !companyCode || !email) {
        return { success: false, error: '全ての項目を入力してください。' };
    }

    try {
        // 2. Generate random password
        const password = generatePassword();

        // 3. Create auth user (using service role key)
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

        const { data: authUser, error: authError } = await serviceClient.auth.admin.createUser({
            email: email,
            password: password,
            email_confirm: true
        });

        if (authError || !authUser.user) {
            console.error('Auth Error:', authError);
            return { success: false, error: 'アカウント作成に失敗しました: ' + authError?.message };
        }


        // 4. Create tenant record (using service role to bypass RLS)
        const { error: tenantError } = await serviceClient
            .from('tenants')
            .insert({
                name: companyName,
                company_code: companyCode,
                owner_id: authUser.user.id
            });

        if (tenantError) {
            console.error('Tenant Error:', tenantError);
            // Rollback: delete auth user
            await serviceClient.auth.admin.deleteUser(authUser.user.id);
            return { success: false, error: 'テナント作成に失敗しました: ' + tenantError.message };
        }

        // 5. Send email with login credentials
        // TODO: Implement email sending
        // For now, return credentials to display on screen

        return {
            success: true,
            credentials: {
                email: email,
                password: password,
                companyCode: companyCode
            }
        };

    } catch (err) {
        const error = err as Error;
        console.error('Unexpected error:', error);
        return { success: false, error: 'システムエラーが発生しました: ' + error.message };
    }
}

// Auto-generate company code
export async function autoGenerateCompanyCode() {
    const supabase = await createClient();

    let code = generateCompanyCode();
    let attempts = 0;

    // Check for uniqueness
    while (attempts < 10) {
        const { data } = await supabase
            .from('tenants')
            .select('id')
            .eq('company_code', code)
            .single();

        if (!data) {
            return code; // Unique code found
        }

        code = generateCompanyCode();
        attempts++;
    }

    return code; // Return anyway after 10 attempts
}

// Get all tenants with their login emails (for super admin)
export async function getAllTenants() {
    const supabase = await createClient();

    // Get all tenants
    const { data: tenants } = await supabase
        .from('tenants')
        .select('id, name, company_code, owner_id, created_at')
        .order('created_at', { ascending: false });

    if (!tenants) return [];

    // Get user emails for each tenant using service role
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

    const tenantsWithEmails = await Promise.all(
        tenants.map(async (tenant) => {
            const { data: userData } = await serviceClient.auth.admin.getUserById(tenant.owner_id);

            return {
                ...tenant,
                email: userData?.user?.email || 'N/A'
            };
        })
    );

    return tenantsWithEmails;
}

// Delete tenant and all associated data
export async function deleteTenant(tenantId: string) {
    // 1. Check super admin permission
    const isAdmin = await isSuperAdmin();
    if (!isAdmin) {
        return { success: false, error: '権限がありません。' };
    }

    try {
        const supabase = await createClient();

        // 2. Get tenant info
        const { data: tenant } = await supabase
            .from('tenants')
            .select('owner_id')
            .eq('id', tenantId)
            .single();

        if (!tenant) {
            return { success: false, error: 'テナントが見つかりません。' };
        }

        // 3. Use service role client for deletion
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
        const serviceClient = createServiceClient(supabaseUrl, supabaseServiceKey);

        // 4. Delete all related data (cascade will handle most of this)
        // Delete tenant record (this will cascade to events, master_data, participations, mail_jobs)
        const { error: tenantError } = await serviceClient
            .from('tenants')
            .delete()
            .eq('id', tenantId);

        if (tenantError) {
            console.error('Tenant Delete Error:', tenantError);
            return { success: false, error: 'テナント削除に失敗しました: ' + tenantError.message };
        }

        // 5. Delete auth user
        const { error: authError } = await serviceClient.auth.admin.deleteUser(tenant.owner_id);

        if (authError) {
            console.error('Auth Delete Error:', authError);
            // Tenant is already deleted, but log the auth error
            return { success: true, warning: 'テナントは削除されましたが、認証ユーザーの削除に失敗しました。' };
        }

        return { success: true };

    } catch (err) {
        const error = err as Error;
        console.error('Unexpected error:', error);
        return { success: false, error: 'システムエラーが発生しました: ' + error.message };
    }
}
