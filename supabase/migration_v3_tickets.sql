-- Migration V3: Ticket System Enhancements

-- 1. Add settings to 'events' table
ALTER TABLE public.events 
ADD COLUMN IF NOT EXISTS is_public_application boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS ticket_config jsonb DEFAULT '[]'::jsonb;

-- 2. Add ticket details to 'participations' table
ALTER TABLE public.participations
ADD COLUMN IF NOT EXISTS ticket_type text,
ADD COLUMN IF NOT EXISTS start_time text,
ADD COLUMN IF NOT EXISTS re_entry_history jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS inviter text,
ADD COLUMN IF NOT EXISTS note text;

-- 3. Update Policies (Ensure new columns are accessible)
-- (Existing policies generally cover "all", but good to double check if we had column-level security. 
--  Our current policies are row-level, so adding columns is fine.)
