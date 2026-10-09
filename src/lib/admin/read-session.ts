import { cache } from 'react';
import { createClient } from '@/utils/supabase/server';

// React cache is scoped to one server render, never shared across users or reloads.
export const getAdminReadSession = cache(async () => {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  return { supabase, user };
});
