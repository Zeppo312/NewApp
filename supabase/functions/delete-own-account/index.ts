import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { createDirectDeletionHandler } from './handler.ts';
Deno.serve(createDirectDeletionHandler({
  env: (key) => Deno.env.get(key),
  createAdmin: (url, key) => createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(20_000) }) },
  }),
}));
