import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    console.error("Supabase Environment Variables are missing! Check .env.local");
    // Return a dummy client or throw to be caught by Error Boundary
    // For now, let's allow it to proceed but it will likely fail on requests, 
    // but at least not crash the *render* if the client is just initialized.
    // Actually createBrowserClient throws if URL is invalid.
    if (!url) throw new Error("NEXT_PUBLIC_SUPABASE_URL is missing in .env.local");
    if (!key) throw new Error("NEXT_PUBLIC_SUPABASE_ANON_KEY is missing in .env.local");
  }

  return createBrowserClient(url, key)
}
