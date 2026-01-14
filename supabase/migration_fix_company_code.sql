-- ROBUST MIGRATION SCRIPT (Run this entire block)

-- 1. Add company_code column (if it doesn't match, it skips)
alter table public.tenants add column if not exists company_code text;

-- 2. Fill any NULL company_code with a unique temporary value
-- This prevents "duplicate key" errors on existing empty rows
update public.tenants 
set company_code = 'temp-' || substr(id::text, 1, 8) 
where company_code is null;

-- 3. Add Unique Constraint safely
do $$ 
begin
  if not exists (select 1 from pg_constraint where conname = 'tenants_company_code_key') then
    alter table public.tenants add constraint tenants_company_code_key unique (company_code);
  end if;
end $$;

-- 4. Cleanup Events constraints (Safe to run multiple times)
alter table public.events drop constraint if exists events_event_code_key;
alter table public.events drop constraint if exists events_tenant_id_event_code_key;

-- 5. Add new Event constraint
alter table public.events add constraint events_tenant_id_event_code_key unique (tenant_id, event_code);

-- 6. Done! After running this, update your company's code manually:
-- update public.tenants set company_code = 'test-corp' where id = 'YOUR_UUID';
