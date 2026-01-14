import { createClient } from "@/utils/supabase/server";
import { NextResponse } from "next/server";

export async function GET() {
    const supabase = await createClient();

    // 0. Get Current User
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: 'ログインが必要です' }, { status: 401 });

    // 1. Insert a test tenant
    const { data: tenant, error: tenantError } = await supabase
        .from('tenants')
        .insert({
            name: '株式会社テスト',
            company_code: 'test-corp',
            owner_id: user.id, // Associate with current user
            smtp_from_email: 'noreply@example.com',
        })
        .select()
        .single();

    if (tenantError) {
        return NextResponse.json({ error: tenantError.message }, { status: 500 });
    }

    // 2. Insert Master Data (Pre-registered employees)
    // These are the people allowed to register.
    const { data: employees, error: masterError } = await supabase
        .from('master_data')
        .insert([
            { tenant_id: tenant.id, employee_id: 'TEST001', name: '山田 太郎' },
            { tenant_id: tenant.id, employee_id: 'TEST002', name: '鈴木 次郎' },
        ])
        .select();

    if (masterError) {
        return NextResponse.json({ error: masterError.message }, { status: 500 });
    }

    return NextResponse.json({
        message: 'Test data created successfully!',
        tenant,
        employees
    });
}
