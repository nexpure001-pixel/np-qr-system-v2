import { createAdminClient } from "@/utils/supabase/admin";
import { NextRequest, NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET(request: NextRequest) {
    // 1. Basic Security
    const authHeader = request.headers.get('Authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabase = createAdminClient();

    // 2. Fetch Pending Jobs with Tenant Info
    const { data: jobs, error } = await supabase
        .from('mail_jobs')
        .select(`
            id, 
            to_email, 
            subject, 
            body,
            tenant_id,
            tenants (
                name,
                smtp_host,
                smtp_port,
                smtp_user,
                smtp_password,
                smtp_from_email,
                smtp_from_name
            )
        `)
        .eq('status', 'pending')
        .limit(30);

    if (error) {
        console.error('Mail Processor: Fetch Error', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    if (!jobs || jobs.length === 0) {
        return NextResponse.json({ message: 'No jobs to process' });
    }

    const results = [];

    for (const job of jobs) {
        try {
            const tenant = job.tenants as unknown as {
                name: string;
                smtp_host: string;
                smtp_port: number;
                smtp_user: string;
                smtp_password: string;
                smtp_from_email: string;
                smtp_from_name: string;
            };

            if (!tenant || !tenant.smtp_host || !tenant.smtp_user || !tenant.smtp_password) {
                throw new Error('テナントのSMTP設定が不完全です。設定画面を確認してください。');
            }

            // 3. Create Transporter
            const transporter = nodemailer.createTransport({
                host: tenant.smtp_host,
                port: tenant.smtp_port,
                secure: tenant.smtp_port === 465,
                auth: {
                    user: tenant.smtp_user,
                    pass: tenant.smtp_password,
                },
            });

            // 4. Send Mail (HTML format for QR code support)
            const fromName = tenant.smtp_from_name || tenant.name;
            await transporter.sendMail({
                from: `"${fromName}" <${tenant.smtp_from_email}>`,
                to: job.to_email,
                subject: job.subject,
                html: job.body, // Changed from 'text' to 'html'
            });

            // 5. Update Status -> Sent
            await supabase
                .from('mail_jobs')
                .update({
                    status: 'sent',
                    processed_at: new Date().toISOString()
                })
                .eq('id', job.id);

            results.push({ id: job.id, status: 'sent' });

        } catch (err) {
            const error = err as Error;
            console.error(`Job ${job.id} failed:`, error);

            // Update Status -> Failed
            await supabase
                .from('mail_jobs')
                .update({
                    status: 'failed',
                    error_message: error.message,
                    processed_at: new Date().toISOString()
                })
                .eq('id', job.id);

            results.push({ id: job.id, status: 'failed', error: error.message });
        }
    }

    return NextResponse.json({ processed: results });
}
