-- Enable pgcrypto for encryption
create extension if not exists pgcrypto;

-- 1. Tenants (Companies)
create table public.tenants (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  domain text, -- e.g., 'example.com' for verifying usage
  
  -- SMTP Settings (Encrypted)
  smtp_host text,
  smtp_port int,
  smtp_user text,
  smtp_password text, -- Store encrypted values here using pgcrypto functions
  smtp_from_email text, -- Force 'From' address

  -- Owner (Supabase Auth User)
  owner_id uuid references auth.users(id),

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Master Data (Participants)
create table public.master_data (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  
  employee_id text not null, -- User input ID
  name text not null,
  email text not null,
  phone text,
  
  checkin_token uuid default gen_random_uuid() not null, -- THE QR CODE Content (Secure UUID)
  checked_in_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 3. Mail Jobs (Queue)
create table public.mail_jobs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  
  to_email text not null,
  subject text not null,
  body text not null,
  
  status text default 'pending' check (status in ('pending', 'processing', 'sent', 'failed')),
  retry_count int default 0,
  error_log text,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.tenants enable row level security;
alter table public.master_data enable row level security;
alter table public.mail_jobs enable row level security;

-- Indexes for performance
create index idx_master_data_tenant on public.master_data(tenant_id);
create index idx_master_data_token on public.master_data(checkin_token);
create index idx_mail_jobs_status on public.mail_jobs(status);

-- NOTE: RLS Policies need to be added after Auth setup.
-- Example: create policy "Tenant Isolation" on tenants using (auth.uid() = owner_id);
