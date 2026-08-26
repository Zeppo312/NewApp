// RevenueCat webhook receiver. This function must be deployed without the
// Supabase JWT gateway check because RevenueCat is not a Supabase user. It
// authenticates every request with BOTH a configured Authorization value and
// RevenueCat's timestamped HMAC signature, then re-fetches current subscriber
// truth from RevenueCat instead of trusting event order or event contents.

// @ts-ignore Deno Edge import
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
// @ts-ignore Deno Edge import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.8';
import { syncRevenueCatTier } from '../_shared/premiumAccess.ts';

declare const Deno: { env: { get: (key: string) => string | undefined } };

const MAX_BODY_BYTES = 64 * 1024;
const MAX_SIGNATURE_AGE_SECONDS = 300;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' },
});

const constantTimeEqual = (left: string, right: string) => {
  const a = new TextEncoder().encode(left);
  const b = new TextEncoder().encode(right);
  let difference = a.length ^ b.length;
  const length = Math.max(a.length, b.length);
  for (let index = 0; index < length; index += 1) difference |= (a[index % a.length] ?? 0) ^ (b[index % b.length] ?? 0);
  return difference === 0;
};

const verifySignature = async (header: string, rawBody: string, secret: string) => {
  const fields = Object.fromEntries(header.split(',').map((part) => part.trim().split('=', 2)));
  const timestamp = Number(fields.t);
  const signature = fields.v1;
  if (!Number.isFinite(timestamp) || typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > MAX_SIGNATURE_AGE_SECONDS) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const digest = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${timestamp}.${rawBody}`));
  const expected = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(expected, signature.toLowerCase());
};

serve(async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    const revenueCatKey = Deno.env.get('REVENUECAT_SECRET_API_KEY');
    const revenueCatProjectId = Deno.env.get('REVENUECAT_PROJECT_ID');
    const premiumEntitlementId = Deno.env.get('REVENUECAT_PREMIUM_ENTITLEMENT_ID');
    const standardEntitlementId = Deno.env.get('REVENUECAT_STANDARD_ENTITLEMENT_ID');
    const liteEntitlementId = Deno.env.get('REVENUECAT_LITE_ENTITLEMENT_ID');
    const expectedAuthorization = Deno.env.get('REVENUECAT_WEBHOOK_AUTHORIZATION');
    const signingSecret = Deno.env.get('REVENUECAT_WEBHOOK_SIGNING_SECRET');
    if (!supabaseUrl || !serviceKey || !revenueCatKey || !revenueCatProjectId || !premiumEntitlementId || !expectedAuthorization || !signingSecret) return json({ error: 'not_configured' }, 503);

    const declaredLength = Number(req.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_BODY_BYTES) return json({ error: 'request_too_large' }, 413);
    const rawBody = await req.text();
    if (new TextEncoder().encode(rawBody).byteLength > MAX_BODY_BYTES) return json({ error: 'request_too_large' }, 413);
    const providedAuthorization = req.headers.get('authorization') ?? '';
    if (!constantTimeEqual(providedAuthorization, expectedAuthorization)) return json({ error: 'unauthorized' }, 401);
    const signature = req.headers.get('x-revenuecat-webhook-signature') ?? '';
    if (!(await verifySignature(signature, rawBody, signingSecret))) return json({ error: 'invalid_signature' }, 401);

    let payload: any;
    try { payload = JSON.parse(rawBody); } catch { return json({ error: 'invalid_json' }, 400); }
    const event = payload?.event;
    const eventId = typeof event?.id === 'string' && event.id.length <= 200 ? event.id : null;
    if (!eventId) return json({ error: 'invalid_event' }, 400);

    const admin = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });
    const { data: existing } = await admin.from('lotti_revenuecat_webhook_events').select('status').eq('event_id', eventId).maybeSingle();
    if (existing?.status === 'completed') return json({ ok: true, duplicate: true });
    await admin.from('lotti_revenuecat_webhook_events').upsert({ event_id: eventId, status: 'processing', received_at: new Date().toISOString(), error_code: null });

    const candidates = [
      event?.app_user_id,
      ...(Array.isArray(event?.transferred_from) ? event.transferred_from : []),
      ...(Array.isArray(event?.transferred_to) ? event.transferred_to : []),
    ].filter((value, index, all): value is string => typeof value === 'string' && UUID_RE.test(value) && all.indexOf(value) === index);
    if (candidates.length === 0) {
      await admin.from('lotti_revenuecat_webhook_events').update({ status: 'completed', completed_at: new Date().toISOString(), error_code: 'no_supabase_user' }).eq('event_id', eventId);
      return json({ ok: true, synced: 0 });
    }

    for (const userId of candidates.slice(0, 10)) {
      await syncRevenueCatTier(
        admin,
        userId,
        revenueCatKey,
        revenueCatProjectId,
        {
          premium: premiumEntitlementId,
          standard: standardEntitlementId,
          lite: liteEntitlementId,
        },
        'revenuecat_webhook',
      );
    }
    await admin.from('lotti_revenuecat_webhook_events').update({ status: 'completed', completed_at: new Date().toISOString(), error_code: null }).eq('event_id', eventId);
    return json({ ok: true, synced: candidates.length });
  } catch (error) {
    console.error('revenuecat-webhook failed:', error instanceof Error ? error.message : 'unknown_error');
    return json({ error: 'temporary_failure' }, 503);
  }
});
