-- 1. Create 'Events' Table (Separates Event from Company)
create table public.events (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid references public.tenants(id) on delete cascade not null,
  
  name text not null,
  event_code text not null unique, -- Must be unique system-wide for easy access
  staff_passcode text not null,

  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- 2. Create 'Participations' Table (Links Employee to Event)
create table public.participations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid references public.events(id) on delete cascade not null,
  master_data_id uuid references public.master_data(id) on delete cascade not null,
  
  -- Event specific contact info (user might change email per event)
  email text, 
  phone text,
  
  -- Check-in Logic
  checkin_token uuid default gen_random_uuid() not null,
  status text default 'pending' check (status in ('pending', 'checked_in', 'cancelled')),
  checked_in_at timestamptz,
  
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure one participation per event per employee
  unique(event_id, master_data_id)
);

-- 3. Enable RLS
alter table public.events enable row level security;
alter table public.participations enable row level security;

-- 4. Policies (Open for MVP/Demo)
-- Events: Public read (for resolving event_code), Admin insert
create policy "Public read events" on public.events for select using (true);
create policy "Admin insert events" on public.events for insert with check (true);

-- Participations: Public select/insert/update (for application flow)
create policy "Public access participations" on public.participations for all using (true) with check (true);
