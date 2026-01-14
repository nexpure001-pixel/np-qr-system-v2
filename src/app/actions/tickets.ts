'use server';

import { createClient } from "@/utils/supabase/server";

interface TicketImportRow {
    name: string;
    email: string;
    order_id?: string;
    ticket_type?: string;
    start_time?: string;
    product_name?: string;
    master_data_id?: string;
}

export async function importTickets(eventId: string, tickets: TicketImportRow[]) {
    const supabase = await createClient();

    // 1. Get User & Tenant
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return { success: false, error: 'ログインしてください。' };

    const { data: tenant } = await supabase
        .from('tenants')
        .select('id, name, smtp_from_email')
        .eq('owner_id', user.id)
        .single();

    if (!tenant) return { success: false, error: 'テナントが見つかりません。' };

    // 2. Fetch Event to verify and get event_code (for QR)
    const { data: event } = await supabase
        .from('events')
        .select('*')
        .eq('id', eventId)
        .eq('tenant_id', tenant.id)
        .single();

    if (!event) return { success: false, error: 'イベントが見つかりません。' };

    // 3. Prepare Bulk Insert Data
    const participationData = [];
    const mailJobsData = [];

    for (const ticket of tickets) {
        // Skip invalid rows
        if (!ticket.name || !ticket.email) {
            continue;
        }

        // Generate participation ID (used for QR code)
        // If we want to use existing Order ID as ID? No, explicit UUID is better for DB.
        // We can store Order ID in 'note' or a separate column if we had one. 
        // For now, note is good.

        // Check for duplicates? (based on email + event)
        // For now, allow multiple tickets per email? Yes.

        // Create Participation
        const participation = {
            event_id: eventId,
            name: ticket.name,
            email: ticket.email,
            company_code: ticket.order_id || '', // Using company_code field for Order ID or similar
            status: 'approved', // Auto-approve imported tickets
            ticket_type: ticket.ticket_type || 'Standard',
            start_time: ticket.start_time || '',
            note: ticket.product_name || '',
            master_data_id: ticket.master_data_id || null, // Link to master data if matched
            invited_by: user.id // Admin imported
        };
        participationData.push(participation);
    }

    if (participationData.length === 0) {
        return { success: false, error: '有効なチケットデータがありません。' };
    }

    // 4. Insert Participations
    const { data: participations, error } = await supabase
        .from('participations')
        .insert(participationData)
        .select();

    if (error) {
        console.error('Import Error:', error);
        return { success: false, error: 'データの保存に失敗しました: ' + error.message };
    }

    // 5. Create Mail Jobs for inserted tickets
    // We need to loop through inserted data to get their IDs (token)
    for (const p of participations) {
        // Generate QR URL
        const qrUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/start?token=${p.id}`;

        // Create Email Body (Generic Simple Template for now, ideally configurable)
        // TODO: Use a proper template engine or allow admin to set template
        const emailBody = `
            <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
                <h2>${event.name} 入場チケットのご案内</h2>
                <p>${p.name} 様</p>
                <p>イベントへのお申し込みありがとうございます。</p>
                <p>以下のチケット情報を確認の上、当日会場へお越しください。</p>
                
                <div style="background: #f5f5f5; padding: 20px; border-radius: 8px; margin: 20px 0;">
                    <p><strong>券種:</strong> ${p.ticket_type}</p>
                    <p><strong>入場開始:</strong> ${p.start_time || '指定なし'}</p>
                    <p><strong>注文番号:</strong> ${p.company_code}</p>
                </div>

                <div style="text-align: center; margin: 30px 0;">
                    <p>▼ 当日の入場用QRコードはこちら ▼</p>
                    <a href="${qrUrl}" style="background: #000; color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
                        チケットを表示する
                    </a>
                    <p style="font-size: 12px; color: #666; margin-top: 10px;">
                        ※このメールを入場口で提示するか、上記リンクからQRコードを表示してください。
                    </p>
                </div>

                <hr style="border: none; border-top: 1px solid #eee; margin: 30px 0;" />
                <p style="font-size: 12px; color: #999;">
                    本メールは送信専用です。<br/>
                    発行元: ${tenant.name || 'Event System'}
                </p>
            </div>
        `;

        mailJobsData.push({
            tenant_id: tenant.id,
            status: 'pending',
            to_email: p.email,
            subject: `【${event.name}】入場チケット送付のお知らせ`,
            body: emailBody,
            retries: 0
        });
    }

    // 6. Insert Mail Jobs
    if (mailJobsData.length > 0) {
        const { error: mailError } = await supabase
            .from('mail_jobs')
            .insert(mailJobsData);

        if (mailError) {
            console.error('Mail Job Error:', mailError);
            // Non-critical, but should verify
        }
    }

    return { success: true, count: participations.length };
}
