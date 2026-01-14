import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';

export async function POST(request: NextRequest) {
    try {
        const { eventId } = await request.json();

        if (!eventId) {
            return NextResponse.json({ success: false, error: 'イベントIDが必要です。' }, { status: 400 });
        }

        const supabase = await createClient();

        // Get user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
            return NextResponse.json({ success: false, error: 'ログインしてください。' }, { status: 401 });
        }

        // Get event details
        const { data: event } = await supabase
            .from('events')
            .select('id, name, event_code, event_date')
            .eq('id', eventId)
            .single();

        if (!event) {
            return NextResponse.json({ success: false, error: 'イベントが見つかりません。' }, { status: 404 });
        }

        // Get unsent participants
        const { data: participants, error: fetchError } = await supabase
            .from('participations')
            .select('id, name, email, ticket_type, qr_code')
            .eq('event_id', eventId)
            .eq('email_sent', false)
            .not('email', 'is', null); // Only those with email addresses

        if (fetchError) {
            console.error('Fetch Error:', fetchError);
            return NextResponse.json({ success: false, error: '参加者の取得に失敗しました。' }, { status: 500 });
        }

        if (!participants || participants.length === 0) {
            return NextResponse.json({ success: false, error: '送信対象の参加者がいません。' }, { status: 400 });
        }

        // Get tenant ID
        const { data: tenant } = await supabase
            .from('tenants')
            .select('id')
            .eq('owner_id', user.id)
            .single();

        if (!tenant) return NextResponse.json({ error: 'Tenant not found' }, { status: 403 });

        // Queue email jobs
        const emailJobs = participants.map(p => {
            const qrUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/checkin/${p.id}`;
            const qrImageUrl = `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrUrl)}`;

            const body = `
                <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #333;">${event.name} 入場チケット</h2>
                    <p>${p.name} 様</p>
                    <p>この度はご登録いただきありがとうございます。当日はこちらのQRコードを受付へご提示ください。</p>
                    
                    <div style="text-align: center; margin: 30px 0; padding: 20px; background: #f9f9f9; border-radius: 10px;">
                        <img src="${qrImageUrl}" alt="QR Code" style="width: 200px; height: 200px;" />
                        <p style="font-size: 12px; color: #666; margin-top: 10px;">※QRコードが表示されない場合は、以下のリンクからご確認ください。</p>
                        <a href="${qrUrl}" style="color: #2563eb; font-size: 14px;">チケットを表示する</a>
                    </div>
                    
                    <div style="border-t: 1px solid #eee; padding-top: 20px; font-size: 14px; color: #555;">
                        <p><strong>券種:</strong> ${p.ticket_type}</p>
                        <p><strong>開催日:</strong> ${event.event_date || '当日'}</p>
                    </div>
                </div>
            `;

            return {
                tenant_id: tenant.id,
                to_email: p.email,
                subject: `【${event.name}】入場チケットのご案内`,
                body: body,
                status: 'pending',
                created_at: new Date().toISOString()
            };
        });

        const { error: insertError } = await supabase
            .from('mail_jobs')
            .insert(emailJobs);

        if (insertError) {
            console.error('Insert Error:', insertError);
            return NextResponse.json({ success: false, error: 'メール送信キューへの追加に失敗しました。' }, { status: 500 });
        }

        // Mark as email_sent
        const participantIds = participants.map(p => p.id);
        const { error: updateError } = await supabase
            .from('participations')
            .update({ email_sent: true })
            .in('id', participantIds);

        if (updateError) {
            console.error('Update Error:', updateError);
        }

        return NextResponse.json({ success: true, count: participants.length });
    } catch (error) {
        console.error('API Error:', error);
        return NextResponse.json({ success: false, error: 'サーバーエラーが発生しました。' }, { status: 500 });
    }
}
