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

        // Queue email jobs
        const emailJobs = participants.map(p => ({
            event_id: eventId,
            participation_id: p.id,
            recipient_email: p.email,
            recipient_name: p.name,
            status: 'pending',
            created_at: new Date().toISOString()
        }));

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
