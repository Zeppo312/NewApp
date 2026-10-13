// @ts-ignore Deno Edge import
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore Deno Edge import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { createFamilyAccessHandler } from './handler.ts';
declare const Deno: { env: { get: (key: string) => string | undefined } };
serve(createFamilyAccessHandler({
  env: key => Deno.env.get(key),
  createAdmin: (url, key) => createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } }),
}));
