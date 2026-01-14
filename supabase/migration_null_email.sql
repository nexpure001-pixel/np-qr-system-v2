-- Make email and phone nullable to support pre-registration of ID/Name only
alter table public.master_data alter column email drop not null;
alter table public.master_data alter column phone drop not null;
