import { createAdminClient } from "@/utils/supabase/admin";
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";

export async function GET() {
    // 1. Basic Security
    // Optional: Check Vercel Cron secret header
    // if (request.headers.get('Authorization') !== `Bearer ${process.env.CRON_SECRET}`) { ... }

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
                smtp_from_email
            )
        `)
        .eq('status', 'pending')
        .limit(10);

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
            await transporter.sendMail({
                from: `"${tenant.name}" <${tenant.smtp_from_email}>`,
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
