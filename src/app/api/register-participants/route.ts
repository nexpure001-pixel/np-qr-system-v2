/** Heartbeat: 2026-01-14 13:32 to force Vercel build **/
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const { eventId, participants } = await request.json();

        if (!eventId || !participants || participants.length === 0) {
            return NextResponse.json({ success: false, error: '必須パラメータが不足しています。' }, { status: 400 });
        }

        const supabase = await createClient();

        // Get user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'ログインしてください。' }, { status: 401 });
        }

        // Verify event belongs to user's tenant
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!tenant) {
            return NextResponse.json({ success: false, error: 'テナントが見つかりません。' }, { status: 403 });
        }

        const { data: event } = await supabase
            .from('events')
            .select('id, ticket_config')
            .eq('id', eventId)
            .eq('tenant_id', tenant.id)
            .single();

        if (!event) {
            return NextResponse.json({ success: false, error: 'イベントが見つかりません。' }, { status: 404 });
        }

        // Determine ticket type based on price/keyword matching
        const ticketRules = event.ticket_config || [];

        const participationsToInsert = participants.map((p: { name: string; email?: string; employeeId?: string; price?: string; master_data_id?: string }) => {
            let ticketType = 'Standard';
            const priceStr = String(p.price || '');
            for (const rule of ticketRules) {
                if (rule.keywords && rule.keywords.some((kw: string) => priceStr.includes(kw))) {
                    ticketType = rule.name;
                    break;
                }
            }

            return {
                event_id: eventId,
                name: p.name,
                email: p.email || null,
                company_code: p.employeeId || null,
                ticket_type: ticketType,
                master_data_id: p.master_data_id || null,
                status: 'pending',
                inviter: user.id, // Corrected from invited_by
                email_sent: false // Requires migration_v7 to be applied
            };
        });

        // Insert participations
        const { error: insertError } = await supabase
            .from('participations')
            .insert(participationsToInsert);

        if (insertError) {
            console.error('Insert Error Detail:', insertError);

            // Helpful error mapping
            let userFriendlyError = insertError.message;
            if (insertError.message.includes('email_sent')) {
                userFriendlyError = 'データベースの更新が必要です（email_sentカラムがありません）。Supabaseでmigration_v7を実行してください。';
            } else if (insertError.message.includes('inviter')) {
                userFriendlyError = 'データベースの構造が一致しません（inviterカラムの確認が必要です）。';
            }

            return NextResponse.json({
                success: false,
                error: userFriendlyError,
                debug: insertError
            }, { status: 500 });
        }

        return NextResponse.json({ success: true, count: participants.length });
    } catch (err) {
        const error = err as Error;
        console.error('API Error:', error);
        return NextResponse.json({
            success: false,
            error: `サーバーエラーが発生しました: ${error.message || '不明なエラー'}`
        }, { status: 500 });
    }
}
