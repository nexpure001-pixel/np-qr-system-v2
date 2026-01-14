-- COMPLETE SETUP SCRIPT (v5)
-- Run this in the Supabase SQL Editor to set up the entire database from scratch.

-- 1. Enable PGCrypto for UUIDs and Encryption
create extension if not exists pgcrypto;

-- 2. TENANTS (Companies)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id), -- Linked to Supabase Auth User
  company_code text unique not null,      -- Unique Company ID (e.g. 'toyota')
  
  -- SMTP Settings
  smtp_host text,
  smtp_port integer,
  smtp_user text,
  smtp_password text,
  smtp_from_email text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. MASTER DATA (Global Employee List per Company)
create table public.master_data (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  
  employee_id text not null, -- Employee ID (e.g. EMP001)
  name text not null,        -- Full Name
  email text,                -- Default email (optional)
  phone text,                -- Default phone (optional)

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Employee ID must be unique within the company
  unique(tenant_id, employee_id)
);

-- 4. EVENTS (Specific Occasions)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  
  name text not null,           -- Event Name
  event_code text not null,     -- Event Code (e.g. '2025')
  staff_passcode text not null, -- Passcode for Staff Login

  -- New fields (v3)
  is_public_application boolean DEFAULT true,
  ticket_config jsonb DEFAULT '[]'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Event Code must be unique within the company
  unique(tenant_id, event_code)
);

-- 5. PARTICIPATIONS (Link Employee/Guest <-> Event)
create table public.participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  
  -- v4: master_data_id is now nullable for Guest tickets
  master_data_id uuid references public.master_data(id) on delete cascade,
  
  -- v4: Guest info directly on participation
  name text,
  company_code text, 

  -- Participant info (overrides master if present)
  email text, 
  phone text,
  
  -- Ticket Info (v3)
  ticket_type text,
  start_time text,
  re_entry_history jsonb DEFAULT '[]'::jsonb,
  inviter text,
  note text, -- stores product name or memo

  -- Check-in Logic
  checkin_token uuid default gen_random_uuid() not null, -- Unique token for QR
  status text default 'pending' check (status in ('approved', 'pending', 'checked_in', 'cancelled')), -- Added 'approved' for imports
  checked_in_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 6. MAIL JOBS (Queue)
create table public.mail_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  
  to_email text not null,
  subject text not null,
  body text not null,
  
  status text default 'pending', -- pending, sent, failed
  error_message text,
  retries integer default 0,
  
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- 7. ENABLE RLS
alter table public.tenants enable row level security;
alter table public.master_data enable row level security;
alter table public.events enable row level security;
alter table public.participations enable row level security;
alter table public.mail_jobs enable row level security;

-- 8. RLS POLICIES

-- Tenants: Public read (for validations), Owner update
create policy "Public read tenants" on public.tenants for select using (true);
create policy "Owners update own tenant" on public.tenants for all using (auth.uid() = owner_id);

-- Master Data: Public insert/read? No, usually restricted.
-- Owner manage
create policy "Owners manage master data" on public.master_data for all using (
  exists (select 1 from public.tenants where id = master_data.tenant_id and owner_id = auth.uid())
);

-- Events: Public read, Owner manage
create policy "Public read events" on public.events for select using (true);
create policy "Owners manage events" on public.events for all using (
  exists (select 1 from public.tenants where id = events.tenant_id and owner_id = auth.uid())
);

-- Participations: Public Insert/Update (Apply/Check-in), Owner Read/Delete
-- Allow public insert for applications
create policy "Public insert participations" on public.participations for insert with check (true);
-- Allow public select for check-in validation
create policy "Public select participations" on public.participations for select using (true);
-- Allow public update for check-in
create policy "Public update participations" on public.participations for update using (true);
-- Owner full access
create policy "Owners manage participations" on public.participations for all using (
  exists (select 1 from public.events join public.tenants on events.tenant_id = tenants.id where events.id = participations.event_id and tenants.owner_id = auth.uid())
);

-- Mail Jobs: Public insert (for system actions triggered by public), Owner manage
create policy "System insert mail" on public.mail_jobs for insert with check (true);
create policy "Owners manage mail" on public.mail_jobs for all using (
  exists (select 1 from public.tenants where id = mail_jobs.tenant_id and owner_id = auth.uid())
);
