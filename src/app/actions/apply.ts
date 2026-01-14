'use server';

import { createClient } from "@/utils/supabase/server";
import QRCode from 'qrcode';

export async function submitApplication(formData: FormData) {
    const supabase = await createClient();

    // 1. Extract Data
    const eventCode = formData.get('event_code') as string;
    const employeeId = formData.get('employee_id') as string;
    const name = formData.get('name') as string;
    const email = formData.get('email') as string;
    const phone = formData.get('phone') as string;

    // Honeypot
    const honeyPot = formData.get('fax_number') as string;
    if (honeyPot) return { success: false, error: null };

    if (!eventCode || !employeeId || !name || !email) {
        return { success: false, error: '必須項目が入力されていません。' };
    }

    try {
        // 2. Resolve Event
        const { data: event, error: eventError } = await supabase
            .from('events')
            .select('id, tenant_id, name, is_public_application')
            .eq('event_code', eventCode)
            .single();

        if (eventError || !event) {
            return { success: false, error: 'イベントコードが無効です。' };
        }

        if (!event.is_public_application) {
            return { success: false, error: 'このイベントは一般公開されていません。招待メールからご参加ください。' };
        }

        // 3. Resolve Tenant (For Name/Email settings)
        const { data: tenant } = await supabase.from('tenants').select('*').eq('id', event.tenant_id).single();
        if (!tenant) return { success: false, error: 'システムエラー: テナント不明' };

        // 4. Validate Employee in Master Data
        const { data: employee, error: findError } = await supabase
            .from('master_data')
            .select('id, name')
            .eq('tenant_id', tenant.id)
            .eq('employee_id', employeeId)
            .single();

        if (findError || !employee) {
            return { success: false, error: '入力された社員IDは名簿に存在しません。' };
        }

        // 5. Check if already Participating in THIS Event
        const { data: existingParticipation } = await supabase
            .from('participations')
            .select('id')
            .eq('event_id', event.id)
            .eq('master_data_id', employee.id)
            .single();

        if (existingParticipation) {
            return { success: false, error: '既にこのイベントへの申し込みは完了しています。' };
        }

        // 6. Create Participation Record
        const { data: participations, error } = await supabase
            .from('participations')
            .insert({
                event_id: event.id,
                master_data_id: employee.id,
                email: email,
                phone: phone,
                checkin_token: crypto.randomUUID(),
                status: 'pending'
            })
            .select('checkin_token')
            .single();

        if (error) {
            console.error('Participation Error:', error);
            return { success: false, error: 'データ保存に失敗しました。' };
        }

        // 7. Queue Email with QR Code
        const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
        const ticketUrl = `${baseUrl}/apply/complete?token=${participations.checkin_token}`;

        // Generate QR code as data URL
        const qrDataUrl = await QRCode.toDataURL(ticketUrl, { width: 300, margin: 2 });

        const emailBody = `<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="color: white; margin: 0;">🎫 受付完了のお知らせ</h1>
    </div>
    <div style="background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; border: 1px solid #e5e7eb;">
        <p style="font-size: 18px; font-weight: bold;">${employee.name} 様</p>
        <p><strong>${event.name}</strong> へのお申し込みありがとうございます。</p>
        <p>当日は以下のQRコードを受付にてご提示ください。</p>
        <div style="background: white; padding: 20px; text-align: center; margin: 20px 0; border: 2px solid #e5e7eb; border-radius: 8px;">
            <img src="${qrDataUrl}" alt="QR Code" style="max-width: 300px; width: 100%;" />
        </div>
        <p style="text-align: center; font-size: 14px; color: #6b7280;">QRコードが表示されない場合は下記URLをクリック</p>
        <div style="text-align: center; margin: 20px 0;">
            <a href="${ticketUrl}" style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 6px; font-weight: bold;">チケットを表示</a>
        </div>
        <div style="background: #fef3c7; border-left: 4px solid #f59e0b; padding: 15px; margin-top: 20px;">
            <p style="margin: 0; font-size: 14px;"><strong>⚠️ 注意</strong><br>このQRコードは当日の受付に必要です。保存してください。</p>
        </div>
    </div>
</body>
</html>`;

        await supabase.from('mail_jobs').insert({
            tenant_id: tenant.id,
            to_email: email,
            subject: `【${event.name}】受付完了のお知らせ`,
            body: emailBody,
            status: 'pending'
        });

        // Trigger Mail Processor
        try {
            const baseUrl = process.env.NEXT_PUBLIC_URL || 'http://localhost:3000';
            fetch(`${baseUrl}/api/cron/mail`, { method: 'GET', cache: 'no-store' });
        } catch {
            // Ignore
        }

        return { success: true, token: participations.checkin_token };

    } catch {
        console.error('Check-in Error: An unknown error occurred.');
        return { success: false, error: 'システムエラーが発生しました。' };
    }
}
