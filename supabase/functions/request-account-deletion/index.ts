import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.98.0';
import { createRequestHandler } from './handler.ts';
Deno.serve(createRequestHandler({ env: (key) => Deno.env.get(key), createAdmin: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }) }));
