-- 1. Tenants: Allow public to read (for validation) and insert (for seeding)
create policy "Enable read access for all users" on public.tenants for select using (true);
create policy "Enable insert access for all users" on public.tenants for insert with check (true);

-- 2. Master Data: Allow public to insert (for application form)
create policy "Enable insert for applicants" on public.master_data for insert with check (true);
create policy "Enable read access for all users" on public.master_data for select using (true);

-- 3. Mail Jobs: Allow public to insert (triggered by application form)
create policy "Enable insert for system" on public.mail_jobs for insert with check (true);
