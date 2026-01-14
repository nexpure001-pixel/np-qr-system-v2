-- Migration V4: Support Guest Tickets (No Master Data Link)

-- 1. Make master_data_id nullable
ALTER TABLE public.participations 
ALTER COLUMN master_data_id DROP NOT NULL;

-- 2. Add 'name' column to participations (to store guest name directly)
ALTER TABLE public.participations 
ADD COLUMN IF NOT EXISTS name text;

-- 3. Add 'company_code' or 'order_id' (optional, map to company_code for now as defined in actions)
ALTER TABLE public.participations 
ADD COLUMN IF NOT EXISTS company_code text;

-- 4. Drop the strict unique constraint (event_id, master_data_id)
-- Note: Constraint name assumes standard naming. If it differs, this might fail.
-- We try to drop it if it exists.
DO $$ 
BEGIN 
    IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'participations_event_id_master_data_id_key') THEN 
        ALTER TABLE public.participations DROP CONSTRAINT participations_event_id_master_data_id_key; 
    END IF; 
END $$;

-- 5. Optional: Add a new unique index if we want to prevent exact duplicate emails per event? 
-- For now, let's allow multiple tickets (e.g. buying 2 tickets with same email).
