-- 1. Add company_code column (Start as nullable)
alter table public.tenants add column if not exists company_code text;

-- 2. Populate existing records with unique values to satisfy future constraint
-- Using ID substring ensures uniqueness
update public.tenants 
set company_code = 'company-' || substr(id::text, 1, 8) 
where company_code is null;

-- 3. Add Unique Constraint
alter table public.tenants add constraint tenants_company_code_key unique (company_code);
alter table public.tenants alter column company_code set not null;

-- 4. Update Events constraint (Events are unique per Tenant, not globally)
alter table public.events drop constraint if exists events_event_code_key;
alter table public.events add constraint events_tenant_id_event_code_key unique (tenant_id, event_code);
