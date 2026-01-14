-- Migration: Standardize Mail Jobs Schema
-- Add updated_at and retry_count to the mail_jobs table.

DO $$
BEGIN
    -- Add updated_at
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mail_jobs' AND column_name='updated_at') THEN
        ALTER TABLE public.mail_jobs ADD COLUMN updated_at timestamptz DEFAULT now();
    END IF;

    -- Add retry_count (Optional but helpful)
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mail_jobs' AND column_name='retry_count') THEN
        ALTER TABLE public.mail_jobs ADD COLUMN retry_count integer DEFAULT 0;
    END IF;

    -- Ensure error_message column is correct (Schema V2 has error_message, old code used error_log)
    IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='mail_jobs' AND column_name='error_log') THEN
        ALTER TABLE public.mail_jobs RENAME COLUMN error_log TO error_message;
    END IF;
END $$;

-- Index for faster lookup of pending jobs
CREATE INDEX IF NOT EXISTS idx_mail_jobs_status_pending ON public.mail_jobs (status) WHERE status = 'pending';
