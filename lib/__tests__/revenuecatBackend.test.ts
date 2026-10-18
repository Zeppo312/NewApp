/** @jest-environment node */
import { createHmac, webcrypto } from 'node:crypto';
import { createWebhookHandler } from '../../supabase/functions/revenuecat-webhook/handler';
import { fetchRevenueCatTier, parseRevenueCatTier, serverProductTier } from '../../supabase/functions/_shared/revenuecatState';
import * as stateModule from '../../supabase/functions/_shared/revenuecatState';
import { syncRevenueCatTier, verifySubscriptionFeatureAccess } from '../../supabase/functions/_shared/premiumAccess';
import { REVENUECAT_PLANS } from '../revenuecatProducts';
import { backendDb, config, future, list, OTHER_USER, paid, SHARED, USER } from './fixtures/revenuecatBackend';

Object.defineProperty(globalThis, 'crypto', { value: webcrypto, configurable: true });
const env: Record<string, string> = {
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SERVICE_ROLE_KEY: 'service-test',
  REVENUECAT_SECRET_API_KEY: 'secret-test', REVENUECAT_PROJECT_ID: 'project-test',
  REVENUECAT_WEBHOOK_AUTHORIZATION: 'Bearer webhook-test', REVENUECAT_WEBHOOK_SIGNING_SECRET: 'hmac-test',
};
const snapshot = (tier: 'lite' | 'premium' | null) => ({ tier, productId: tier ? `lottibaby_${tier}:monthly` : null, expiresAt: tier ? new Date(future()).toISOString() : null });
const request = (event: any, overrides: { auth?: string; timestamp?: number; raw?: string; signature?: string } = {}) => {
  const raw = overrides.raw ?? JSON.stringify({ api_version: '1.0', event });
  const timestamp = overrides.timestamp ?? Math.floor(Date.now() / 1000);
  const signature = overrides.signature ?? `t=${timestamp},v1=${createHmac('sha256', env.REVENUECAT_WEBHOOK_SIGNING_SECRET).update(`${timestamp}.${raw}`).digest('hex')}`;
  return new Request('https://example.test/webhook', { method: 'POST', body: raw, headers: {
    Authorization: overrides.auth ?? env.REVENUECAT_WEBHOOK_AUTHORIZATION, 'X-RevenueCat-Webhook-Signature': signature,
  } });
};
const event = (extra = {}) => ({ id: 'event-1', type: 'RENEWAL', app_user_id: USER, store: 'PLAY_STORE', ...extra });
const cache = (db: ReturnType<typeof backendDb>, extra = {}) => db.tables.lotti_subscription_entitlements.set(USER, {
  user_id: USER, tier: 'premium', is_premium: true, checked_at: new Date(Date.now() - 1_000).toISOString(), expires_at: new Date(future()).toISOString(), ...extra,
});
const routeRevenueCat = (subs = [paid()], grants = [{ entitlement_id: SHARED, expires_at: future() }], products: Record<string, string> = { 'prod-paid': 'lottibaby_premium:monthly' }) => {
  return jest.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/active_entitlements')) return Response.json(list(grants));
    if (path.endsWith('/subscriptions')) return Response.json(list(subs));
    const id = path.split('/').pop()!;
    if (products[id]) return Response.json({ id, store_identifier: products[id] });
    throw new Error(`Unexpected request ${path}`);
  });
};
beforeEach(() => jest.spyOn(console, 'error').mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe('RevenueCat current subscription truth', () => {
  it.each(REVENUECAT_PLANS.map(plan => [plan.key, plan]))('matches the client product contract: %s', async (_, plan) => {
    expect(serverProductTier(plan.ios, 'app_store')).toBe(plan.tier);
    expect(serverProductTier(`${plan.google}:${plan.interval}`, 'play_store')).toBe(plan.tier);
    expect(serverProductTier(plan.ios, 'play_store')).toBeNull();
    expect(serverProductTier(`${plan.google}:unconfirmed`, 'play_store')).toBeNull();
    routeRevenueCat([paid({ store: 'app_store' })], undefined, { 'prod-paid': plan.ios });
    expect(await fetchRevenueCatTier(USER, 'key', 'project-test', config)).toMatchObject({ tier: plan.tier, productId: plan.ios });
  });

  it('never interprets the shared legacy entitlement as Premium, even with a wrong old env value', async () => {
    routeRevenueCat([paid()], undefined, { 'prod-paid': 'lottibaby_lite:monthly' });
    expect((await fetchRevenueCatTier(USER, 'key', 'project-test', { premium: SHARED })).tier).toBe('lite');
  });
  it.each(['cancelled', 'in_grace_period', 'unknown'])('keeps paid access when gives_access is true (%s)', async status => {
    routeRevenueCat([paid({ status, ends_at: Date.now() - 1_000, pending_payment: true, auto_renewal_status: 'will_not_renew' })]);
    const result = await fetchRevenueCatTier(USER, 'key', 'project-test', config);
    expect(result.tier).toBe('premium');
    expect(Date.parse(result.expiresAt!)).toBeGreaterThan(Date.now());
    expect(Date.parse(result.expiresAt!)).toBeLessThanOrEqual(Date.now() + 15 * 60_000);
  });
  it.each(['expired', 'in_billing_retry', 'paused', 'incomplete'])('does not grant a non-access subscription (%s)', async status => {
    routeRevenueCat([paid({ status, gives_access: false })], []);
    expect((await fetchRevenueCatTier(USER, 'key', 'project-test', config)).tier).toBeNull();
  });
  it('does not confuse a still-active Lite subscription with refunded Premium', async () => {
    routeRevenueCat([paid({ gives_access: false }), paid({ product_id: 'prod-lite' })], undefined, { 'prod-lite': 'lottibaby_lite:yearly' });
    expect((await fetchRevenueCatTier(USER, 'key', 'project-test', config)).tier).toBe('lite');
  });
  it('bounds overlapping Premium by its own period, not the shared Lite expiry', async () => {
    const premiumEnd = Date.now() + 120_000;
    routeRevenueCat([paid({ ends_at: premiumEnd }), paid({ product_id: 'prod-lite' })], undefined,
      { 'prod-paid': 'lottibaby_premium:monthly', 'prod-lite': 'lottibaby_lite:yearly' });
    expect(await fetchRevenueCatTier(USER, 'key', 'project-test', config)).toMatchObject({ tier: 'premium', expiresAt: new Date(premiumEnd).toISOString() });
  });
  it('supports explicit lifetime grants without claiming they are Store product IDs', () => {
    expect(parseRevenueCatTier(list([{ entitlement_id: 'ent-premium', expires_at: null }]), config)).toEqual({ tier: 'premium', productId: null, expiresAt: null });
  });
  it.each([undefined, 'broken', '', '1234'])('rejects malformed expiry rather than granting lifetime: %s', expiry => {
    expect(() => parseRevenueCatTier(list([{ entitlement_id: 'ent-premium', expires_at: expiry }]), config)).toThrow('revenuecat_invalid_expiry');
  });
  it('rejects duplicate tier bindings and incomplete successful API responses', () => {
    expect(() => parseRevenueCatTier(list([]), { premium: 'same', lite: 'same' })).toThrow('ambiguous');
    expect(() => parseRevenueCatTier({}, config)).toThrow('invalid_response');
  });
  it.each([401, 403, 404, 429, 500])('does not turn API status %i into cached revocation', async status => {
    jest.spyOn(globalThis, 'fetch').mockResolvedValue(new Response('', { status }));
    await expect(fetchRevenueCatTier(USER, 'key', 'project-test', config)).rejects.toThrow(`revenuecat_${status}`);
  });
  it('follows pagination and refuses to send credentials to a foreign next_page', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch').mockResolvedValueOnce(Response.json(list([], '/v2/projects/project-test/customers/u/active_entitlements?starting_after=1')));
    await expect(fetchRevenueCatTier(USER, 'key', 'project-test', config)).rejects.toThrow('invalid_page');
    fetcher.mockReset().mockResolvedValueOnce(Response.json(list([], 'https://attacker.test/v2/projects/project-test/customers/'+USER+'/active_entitlements')));
    await expect(fetchRevenueCatTier(USER, 'key', 'project-test', config)).rejects.toThrow('invalid_page');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('accepts an omitted next_page as the documented end of a list', async () => {
    jest.spyOn(globalThis, 'fetch').mockImplementation(async () => Response.json({ items: [] }));
    expect((await fetchRevenueCatTier(USER, 'key', 'project-test', config)).tier).toBeNull();
  });
  it('reads later entitlement and subscription pages', async () => {
    const fetcher = jest.spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(Response.json(list([], `/v2/projects/project-test/customers/${USER}/active_entitlements?starting_after=1`)))
      .mockResolvedValueOnce(Response.json(list([{ entitlement_id: SHARED, expires_at: future() }])))
      .mockResolvedValueOnce(Response.json(list([], `/v2/projects/project-test/customers/${USER}/subscriptions?starting_after=1`)))
      .mockResolvedValueOnce(Response.json(list([paid()])))
      .mockResolvedValueOnce(Response.json({ id: 'prod-paid', store_identifier: 'lottibaby_premium:monthly' }));
    expect((await fetchRevenueCatTier(USER, 'key', 'project-test', config)).tier).toBe('premium');
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('reports unmapped shared products without silently demoting subscribers', async () => {
    routeRevenueCat(undefined, undefined, { 'prod-paid': 'unmapped-plan' });
    await expect(fetchRevenueCatTier(USER, 'key', 'project-test', config)).rejects.toThrow('unmapped_product');
  });
});

describe('authenticated webhook deliveries', () => {
  const setup = () => {
    const db = backendDb(); const sync = jest.fn().mockResolvedValue(snapshot('premium'));
    const handle = createWebhookHandler({ env: key => env[key], createAdmin: () => db, sync });
    return { db, sync, handle };
  };
  it('accepts the documented HMAC over exact JSON, including whitespace and UTF-8', async () => {
    const { handle, sync } = setup();
    const raw = '{ "event" : '+JSON.stringify(event({ extra: 'Grüße 👶' }))+' }';
    expect((await handle(request(null, { raw }))).status).toBe(200);
    expect(sync).toHaveBeenCalledTimes(1);
  });
  it.each([{ auth: 'wrong' }, { signature: '' }, { signature: 't=1,v1=bad' }, { timestamp: 1 }])('rejects invalid authentication %o', async overrides => {
    const { handle, db } = setup();
    expect((await handle(request(event(), overrides))).status).toBe(401);
    expect(db.from).not.toHaveBeenCalled();
  });
  it('requires both configured secrets; missing config never disables auth', async () => {
    for (const missing of ['REVENUECAT_WEBHOOK_AUTHORIZATION', 'REVENUECAT_WEBHOOK_SIGNING_SECRET']) {
      const handler = createWebhookHandler({ env: key => key === missing ? undefined : env[key], createAdmin: jest.fn() });
      expect((await handler(request(event()))).status).toBe(503);
    }
  });
  it('accepts old events with freshly signed retries and deduplicates completed IDs', async () => {
    const { handle, sync } = setup();
    const old = event({ event_timestamp_ms: 1 });
    expect((await handle(request(old))).status).toBe(200);
    expect(await (await handle(request(old))).json()).toMatchObject({ duplicate: true });
    expect(sync).toHaveBeenCalledTimes(1);
  });
  it('rejects a valid signature reused with a modified body', async () => {
    const { handle } = setup();
    const signed = request(event());
    const tampered = new Request(signed.url, { method: 'POST', headers: signed.headers, body: JSON.stringify({ event: event({ app_user_id: OTHER_USER }) }) });
    expect((await handle(tampered)).status).toBe(401);
  });
  it('finds Supabase identities through anonymous aliases and transfers both sides', async () => {
    const { handle, sync } = setup();
    expect((await handle(request(event({ app_user_id: '$RCAnonymousID:123', original_app_user_id: USER, aliases: [USER], transferred_from: [USER], transferred_to: [OTHER_USER] })))).status).toBe(200);
    expect(sync.mock.calls.map(call => call[1])).toEqual([USER, OTHER_USER]);
  });
  it('handles more than ten identities without falsely acknowledging skipped users', async () => {
    const { handle, sync, db } = setup();
    const aliases = Array.from({ length: 12 }, (_, i) => `12345678-1234-4234-8234-${String(i).padStart(12, '0')}`);
    aliases.forEach(id => db.users.add(id));
    expect(await (await handle(request(event({ app_user_id: 'anonymous', aliases })))).json()).toMatchObject({ synced: 12 });
    expect(sync).toHaveBeenCalledTimes(12);
  });
  it('skips deleted users, but retries Auth lookup failures', async () => {
    const { handle, db, sync } = setup();
    db.users.delete(USER);
    expect((await handle(request(event()))).status).toBe(200);
    expect(sync).not.toHaveBeenCalled();
    db.auth.admin.getUserById.mockResolvedValueOnce({ data: null, error: { status: 503, code: 'unavailable' } });
    expect((await handle(request(event({ id: 'event-2' })))).status).toBe(503);
  });
  it.each(['insert', 'read', 'update'])('does not acknowledge failed event-table %s operations', async operation => {
    const { handle, db } = setup();
    db.failures[`lotti_revenuecat_webhook_events:${operation}`] = 1;
    expect((await handle(request(event()))).status).toBe(503);
    expect((await handle(request(event()))).status).toBe(200);
  });
  it('retries all identities after partial failure, and marks complete only on success', async () => {
    const { handle, sync, db } = setup();
    sync.mockResolvedValueOnce(snapshot('premium')).mockRejectedValueOnce(new Error('temporary'));
    const transfer = event({ type: 'TRANSFER', transferred_to: [OTHER_USER] });
    expect((await handle(request(transfer))).status).toBe(503);
    expect(db.tables.lotti_revenuecat_webhook_events.get('event-1').status).toBe('processing');
    expect((await handle(request(transfer))).status).toBe(200);
    expect(sync).toHaveBeenCalledTimes(4);
  });
  it('acknowledges signed dashboard TEST without touching user entitlements', async () => {
    const { handle, sync } = setup();
    expect((await handle(request(event({ type: 'TEST' })))).status).toBe(200);
    expect(sync).not.toHaveBeenCalled();
  });
  it.each(['APP_STORE', 'PLAY_STORE'])('reconciles lifecycle events for %s using current truth, regardless of event order', async store => {
    const db = backendDb();
    const current = jest.spyOn(stateModule, 'fetchRevenueCatTier').mockResolvedValue(snapshot('premium'));
    const handle = createWebhookHandler({ env: key => env[key], createAdmin: () => db });
    for (const type of ['INITIAL_PURCHASE', 'CANCELLATION', 'BILLING_ISSUE', 'UNCANCELLATION', 'SUBSCRIPTION_PAUSED', 'RENEWAL', 'EXPIRATION', 'FUTURE_EVENT']) {
      expect((await handle(request(event({ id: type, type, store, event_timestamp_ms: 1 })))).status).toBe(200);
      expect(db.tables.lotti_subscription_entitlements.get(USER).tier).toBe('premium');
    }
    current.mockResolvedValue(snapshot(null));
    expect((await handle(request(event({ id: 'refund', type: 'CANCELLATION', cancel_reason: 'CUSTOMER_SUPPORT', store })))).status).toBe(200);
    expect(db.tables.lotti_subscription_entitlements.get(USER).tier).toBeNull();
  });
  it('processes overlapping duplicate deliveries without resetting completed state', async () => {
    const db = backendDb();
    jest.spyOn(stateModule, 'fetchRevenueCatTier').mockResolvedValue(snapshot('premium'));
    const handle = createWebhookHandler({ env: key => env[key], createAdmin: () => db });
    const responses = await Promise.all([handle(request(event())), handle(request(event()))]);
    expect(responses.map(response => response.status)).toEqual([200, 200]);
    expect(db.tables.lotti_revenuecat_webhook_events.get('event-1').status).toBe('completed');
    expect(db.tables.lotti_subscription_entitlements.get(USER).tier).toBe('premium');
  });
  it('integrates signed Google deliveries, HTTP truth and cache writes across cancel, refund and restore', async () => {
    const db = backendDb();
    const handle = createWebhookHandler({ env: key => env[key], createAdmin: () => db });
    const fetcher = routeRevenueCat([paid({ auto_renewal_status: 'will_not_renew' })]);
    expect((await handle(request(event({ type: 'CANCELLATION' })))).status).toBe(200);
    expect(db.tables.lotti_subscription_entitlements.get(USER).tier).toBe('premium');
    fetcher.mockRestore();
    const revoked = routeRevenueCat([], []);
    expect((await handle(request(event({ id: 'refund', type: 'CANCELLATION' })))).status).toBe(200);
    expect(db.tables.lotti_subscription_entitlements.get(USER).tier).toBeNull();
    revoked.mockRestore(); routeRevenueCat();
    expect((await handle(request(event({ id: 'restore', type: 'RENEWAL' })))).status).toBe(200);
    expect(db.tables.lotti_subscription_entitlements.get(USER).tier).toBe('premium');
    // Old expiry arrives AFTER restore: fetching current state keeps access.
    expect((await handle(request(event({ id: 'old', type: 'EXPIRATION', event_timestamp_ms: 1 })))).status).toBe(200);
    expect(db.tables.lotti_subscription_entitlements.get(USER).tier).toBe('premium');
  });
  it('rejects malformed, empty-ID, oversized and non-POST deliveries', async () => {
    const { handle } = setup();
    expect((await handle(request(null, { raw: '{' }))).status).toBe(400);
    expect((await handle(request(event({ id: '' })))).status).toBe(400);
    expect((await handle(request(event(), { raw: 'x'.repeat(65 * 1024) }))).status).toBe(413);
    expect((await handle(new Request('https://example.test'))).status).toBe(405);
  });
});

describe('cache concurrency and server feature authorization', () => {
  it.each([false, true])('discards an older in-flight snapshot after a concurrent cache write (existing row: %s)', async existing => {
    const db = backendDb(); if (existing) cache(db);
    let release!: (value: ReturnType<typeof snapshot>) => void;
    let started!: () => void;
    const pending = new Promise<void>(resolve => { started = resolve; });
    const fetcher = jest.spyOn(stateModule, 'fetchRevenueCatTier')
      .mockImplementationOnce(() => { started(); return new Promise(resolve => { release = resolve; }); })
      .mockResolvedValue(snapshot(null));
    const slow = syncRevenueCatTier(db, USER, 'key', 'project', config, 'revenuecat_api');
    await pending;
    await syncRevenueCatTier(db, USER, 'key', 'project', config, 'revenuecat_webhook');
    release(snapshot('premium'));
    expect((await slow).tier).toBeNull();
    expect(db.tables.lotti_subscription_entitlements.get(USER).tier).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('does not use stale positive fallback beyond expiry or 24 hours', async () => {
    const db = backendDb();
    db.tables.subscription_plan_features.set('feature', { feature_key: 'fragLotti', plan_key: 'premium', enabled: true });
    jest.spyOn(stateModule, 'fetchRevenueCatTier').mockRejectedValue(new Error('outage'));
    for (const extra of [{ expires_at: new Date(Date.now() - 1).toISOString() }, { checked_at: new Date(Date.now() - 25 * 3600_000).toISOString() }, { checked_at: 'invalid' }, { checked_at: new Date(Date.now() + 60_000).toISOString() }]) {
      cache(db, extra);
      expect((await verifySubscriptionFeatureAccess(db, USER, 'fragLotti', 'key', 'project', config)).allowed).toBe(false);
    }
    cache(db, { checked_at: new Date(Date.now() - 3600_000).toISOString() });
    expect((await verifySubscriptionFeatureAccess(db, USER, 'fragLotti', 'key', 'project', config)).allowed).toBe(true);
  });
  it.each(['expired', 'negative'])('refreshes a fresh %s cache after renewal/restore', async kind => {
    const db = backendDb(); cache(db, kind === 'expired' ? { expires_at: new Date(Date.now() - 1).toISOString() } : { tier: null, is_premium: false, expires_at: null });
    db.tables.subscription_plan_features.set('feature', { feature_key: 'fragLotti', plan_key: 'premium', enabled: true });
    const fetcher = jest.spyOn(stateModule, 'fetchRevenueCatTier').mockResolvedValue(snapshot('premium'));
    expect((await verifySubscriptionFeatureAccess(db, USER, 'fragLotti', 'key', 'project', config)).allowed).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('does not resurrect a positive fallback revoked by a webhook during an API failure', async () => {
    const db = backendDb(); cache(db, { checked_at: new Date(Date.now() - 3600_000).toISOString() });
    db.tables.subscription_plan_features.set('feature', { feature_key: 'fragLotti', plan_key: 'premium', enabled: true });
    jest.spyOn(stateModule, 'fetchRevenueCatTier').mockImplementation(async () => {
      cache(db, { tier: null, is_premium: false, expires_at: null, checked_at: new Date().toISOString() });
      throw new Error('outage');
    });
    expect((await verifySubscriptionFeatureAccess(db, USER, 'fragLotti', 'key', 'project', config)).allowed).toBe(false);
  });
  it('checks the database feature matrix even for a valid Premium cache', async () => {
    const db = backendDb(); cache(db);
    db.tables.subscription_plan_features.set('feature', { feature_key: 'fragLotti', plan_key: 'premium', enabled: false });
    expect(await verifySubscriptionFeatureAccess(db, USER, 'fragLotti', 'key', 'project', config)).toMatchObject({ allowed: false, reason: 'feature_disabled' });
  });
  it.each(['read', 'insert', 'update'])('reports cache %s failures', async operation => {
    const db = backendDb(); if (operation === 'update') cache(db);
    db.failures[`lotti_subscription_entitlements:${operation}`] = 1;
    jest.spyOn(stateModule, 'fetchRevenueCatTier').mockResolvedValue(snapshot('premium'));
    await expect(syncRevenueCatTier(db, USER, 'key', 'project', config, 'revenuecat_api')).rejects.toThrow('subscription_cache');
  });
});
