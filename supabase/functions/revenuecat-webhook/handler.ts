import { workerRpc } from '../_shared/accountDeletion/contracts.ts';
import { syncRevenueCatTier } from '../_shared/premiumAccess.ts';

const MAX_BODY_BYTES = 64 * 1024;
const MAX_SIGNATURE_AGE_SECONDS = 300;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
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

export const verifySignature = async (header: string, rawBody: string | Uint8Array, secret: string) => {
  const fields = Object.fromEntries(header.split(',').map((part) => part.trim().split('=', 2)));
  const timestamp = Number(fields.t);
  if (!/^[0-9]+$/.test(fields.t ?? '') || !Number.isSafeInteger(timestamp)) return false;
  const signature = fields.v1;
  if (!Number.isFinite(timestamp) || typeof signature !== 'string' || !/^[0-9a-f]{64}$/i.test(signature)) return false;
  if (Math.abs(Math.floor(Date.now() / 1000) - timestamp) > MAX_SIGNATURE_AGE_SECONDS) return false;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const prefix = new TextEncoder().encode(`${fields.t}.`);
  const body = typeof rawBody === 'string' ? new TextEncoder().encode(rawBody) : rawBody;
  const signed = new Uint8Array(prefix.length + body.length);
  signed.set(prefix); signed.set(body, prefix.length);
  const digest = await crypto.subtle.sign('HMAC', key, signed);
  const expected = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
  return constantTimeEqual(expected, signature.toLowerCase());
};

type Dependencies = {
  env: (key: string) => string | undefined;
  createAdmin: (url: string, key: string) => any;
  sync?: typeof syncRevenueCatTier;
};

export const createWebhookHandler = ({ env, createAdmin, sync = syncRevenueCatTier }: Dependencies) => async (req: Request) => {
  if (req.method !== 'POST') return json({ error: 'method_not_allowed' }, 405);
  try {
    const supabaseUrl = env('SUPABASE_URL');
    const serviceKey = env('SUPABASE_SERVICE_ROLE_KEY');
    const revenueCatKey = env('REVENUECAT_SECRET_API_KEY');
    const revenueCatProjectId = env('REVENUECAT_PROJECT_ID');
    const premiumEntitlementId = env('REVENUECAT_PREMIUM_ENTITLEMENT_ID');
    const standardEntitlementId = env('REVENUECAT_STANDARD_ENTITLEMENT_ID');
    const liteEntitlementId = env('REVENUECAT_LITE_ENTITLEMENT_ID');
    const expectedAuthorization = env('REVENUECAT_WEBHOOK_AUTHORIZATION');
    const signingSecret = env('REVENUECAT_WEBHOOK_SIGNING_SECRET');
    if (!supabaseUrl || !serviceKey || !revenueCatKey || !revenueCatProjectId || !expectedAuthorization || !signingSecret) return json({ error: 'not_configured' }, 503);

    const declaredLength = Number(req.headers.get('content-length') ?? 0);
    if (declaredLength > MAX_BODY_BYTES) return json({ error: 'request_too_large' }, 413);
    const providedAuthorization = req.headers.get('authorization') ?? '';
    if (!constantTimeEqual(providedAuthorization, expectedAuthorization)) return json({ error: 'unauthorized' }, 401);
    // Bound the body while reading, including chunked requests without Content-Length.
    const reader = req.body?.getReader();
    const chunks: Uint8Array[] = [];
    let length = 0;
    if (reader) {
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        length += value.byteLength;
        if (length > MAX_BODY_BYTES) { await reader.cancel(); return json({ error: 'request_too_large' }, 413); }
        chunks.push(value);
      }
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.length; }
    const signature = req.headers.get('x-revenuecat-webhook-signature') ?? '';
    if (!(await verifySignature(signature, bytes, signingSecret))) return json({ error: 'invalid_signature' }, 401);

    let payload: any;
    try { payload = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)); } catch { return json({ error: 'invalid_json' }, 400); }
    const event = payload?.event;
    const eventId = typeof event?.id === 'string' && event.id.length > 0 && event.id.length <= 200 ? event.id : null;
    if (!eventId || typeof event.type !== 'string' || !event.type) return json({ error: 'invalid_event' }, 400);

    const admin = createAdmin(supabaseUrl, serviceKey);
    const { error: insertError } = await admin.from('lotti_revenuecat_webhook_events').upsert({
      event_id: eventId, status: 'processing', received_at: new Date().toISOString(), error_code: null,
    }, { onConflict: 'event_id', ignoreDuplicates: true });
    if (insertError) throw new Error('webhook_event_insert_failed');
    const { data: existing, error: readError } = await admin.from('lotti_revenuecat_webhook_events')
      .select('status').eq('event_id', eventId).maybeSingle();
    if (readError || !existing) throw new Error('webhook_event_read_failed');
    if (existing.status === 'completed') return json({ ok: true, duplicate: true });

    const candidates = event.type === 'TEST' ? [] : [...new Set([
      event.app_user_id, event.original_app_user_id,
      ...(Array.isArray(event.aliases) ? event.aliases : []),
      ...(Array.isArray(event.transferred_from) ? event.transferred_from : []),
      ...(Array.isArray(event.transferred_to) ? event.transferred_to : []),
    ].filter((value): value is string => typeof value === 'string' && UUID_RE.test(value)))];
    let synced = 0;
    // No truncation: transferred-from AND transferred-to users are reconciled
    // independently through their RC identity. Aliases are never copied as grants.
    for (const userId of candidates) {
      const { data, error } = await admin.auth.admin.getUserById(userId);
      if (error?.status === 404 || error?.code === 'user_not_found') continue;
      if (error || !data?.user) throw new Error('webhook_user_lookup_failed');
      if (await workerRpc(admin, 'blocked', { userId })) continue;
      await sync(admin, userId, revenueCatKey, revenueCatProjectId, {
        premium: premiumEntitlementId, standard: standardEntitlementId, lite: liteEntitlementId,
      }, 'revenuecat_webhook');
      synced += 1;
    }
    const { data: completed, error: completeError } = await admin.from('lotti_revenuecat_webhook_events').update({
      status: 'completed', completed_at: new Date().toISOString(),
      error_code: event.type === 'TEST' ? 'test_event' : synced === 0 ? 'no_supabase_user' : null,
    }).eq('event_id', eventId).select('event_id');
    if (completeError || completed?.length !== 1) throw new Error('webhook_event_complete_failed');
    return json({ ok: true, synced });
  } catch (error) {
    console.error('revenuecat-webhook failed:', error instanceof Error ? error.message : 'unknown_error');
    return json({ error: 'temporary_failure' }, 503);
  }
};
