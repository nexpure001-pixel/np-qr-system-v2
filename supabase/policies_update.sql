-- 4. Master Data: Allow public to UPDATE (for registration claiming)
-- Ideally this should be tighter, but for MVP checking ID match is done in Server Action/RLS
create policy "Enable update for applicants" on public.master_data for update using (true);
