-- Fix: Allow mail processor to read and update mail_jobs

-- 1. Drop the old restrictive policy
DROP POLICY IF EXISTS "System insert mail" ON public.mail_jobs;

-- 2. Create new policies for mail processing
-- Allow system to insert mail jobs
CREATE POLICY "Allow insert mail jobs" ON public.mail_jobs 
FOR INSERT 
WITH CHECK (true);

-- Allow system to read pending mail jobs
CREATE POLICY "Allow read mail jobs" ON public.mail_jobs 
FOR SELECT 
USING (true);

-- Allow system to update mail job status
CREATE POLICY "Allow update mail jobs" ON public.mail_jobs 
FOR UPDATE 
USING (true);
