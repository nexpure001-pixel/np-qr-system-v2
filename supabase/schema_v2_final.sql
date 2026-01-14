-- QR-LESS SYSTEM V2 FINAL SCHEMA
-- Use this to reset the database or reference the complete structure.

-- Enable PGCrypto for UUIDs and Encryption
create extension if not exists pgcrypto;

-- 1. TENANTS (Companies)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  owner_id uuid references auth.users(id), -- Linked to Supabase Auth User
  company_code text unique not null,      -- Unique Company ID (e.g. 'toyota')
  
  -- SMTP Settings (Encrypted in practice, plain text for now/mvp)
  smtp_host text,
  smtp_port integer,
  smtp_user text,
  smtp_password text, -- Should be encrypted content
  smtp_from_email text,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. MASTER DATA (Global Employee List per Company)
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

-- 3. EVENTS (Specific Occasions)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  
  name text not null,           -- Event Name (e.g. '2025 Seminar')
  event_code text not null,     -- Event Code (e.g. '2025')
  staff_passcode text not null, -- Passcode for Staff Login

  created_at timestamptz default now(),
  updated_at timestamptz default now(),

  -- Event Code must be unique within the company
  unique(tenant_id, event_code)
);

-- 4. PARTICIPATIONS (Link Employee <-> Event)
create table public.participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  master_data_id uuid references public.master_data(id) on delete cascade not null,
  
  -- Event-specific contact info (overrides master data if needed)
  email text, 
  phone text,
  
  -- Check-in Logic
  checkin_token uuid default gen_random_uuid() not null, -- Unique token for QR
  status text default 'pending' check (status in ('pending', 'checked_in', 'cancelled')),
  checked_in_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure one participation per event per employee
  unique(event_id, master_data_id)
);

-- 5. MAIL JOBS (Queue)
create table public.mail_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  
  to_email text not null,
  subject text not null,
  body text not null,
  
  status text default 'pending', -- pending, sent, failed
  error_message text,
  
  created_at timestamptz default now(),
  processed_at timestamptz
);

-- 6. ENABLE RLS
alter table public.tenants enable row level security;
alter table public.master_data enable row level security;
alter table public.events enable row level security;
alter table public.participations enable row level security;
alter table public.mail_jobs enable row level security;

-- 7. RLS POLICIES (MVP: Permissive but can be tightened)

-- Tenants: Public read (for validations), Owner update
create policy "Public read tenants" on public.tenants for select using (true);
create policy "Owners update own tenant" on public.tenants for update using (auth.uid() = owner_id);

-- Master Data: Public insert (legacy requirement?), Owner manage
create policy "Owners manage master data" on public.master_data for all using (
  exists (select 1 from public.tenants where id = master_data.tenant_id and owner_id = auth.uid())
);

-- Events: Public read, Owner manage
create policy "Public read events" on public.events for select using (true);
create policy "Owners manage events" on public.events for all using (
  exists (select 1 from public.tenants where id = events.tenant_id and owner_id = auth.uid())
);

-- Participations: Public Update (Apply/Check-in), Owner Read
create policy "Public access participations" on public.participations for all using (true) with check (true);

-- Mail Jobs: System insert
create policy "System insert mail" on public.mail_jobs for insert with check (true);
