import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { createProcessHandler } from './handler.ts';
Deno.serve(createProcessHandler({
  env: (key) => Deno.env.get(key),
  createAdmin: (url, key) => createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    // Three objects per invocation, with bounded remove/list/cache-purge calls, fit
    // within the three-minute lease even when the service is slow.
    global: { fetch: (input, init) => fetch(input, {
      ...init,
      signal: init?.signal
        ? AbortSignal.any([init.signal, AbortSignal.timeout(10_000)])
        : AbortSignal.timeout(10_000),
    }) },
  }),
}));
