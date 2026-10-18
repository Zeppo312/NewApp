/** @jest-environment node */
import { fetchRevenueCatTier } from '../../supabase/functions/_shared/revenuecatState';
import { resolveFamilySubscriptionAccess, syncRevenueCatTier, verifySubscriptionFeatureAccess } from '../../supabase/functions/_shared/premiumAccess';
import { createFamilyAccessHandler } from '../../supabase/functions/family-subscription-access/handler';
import { createReconcileHandler } from '../../supabase/functions/reconcile-family-subscriptions/handler';
import { backendDb, config, future, list, paid, SHARED, USER, OTHER_USER } from './fixtures/revenuecatBackend';
const purchased = (overrides = {}) => paid({ customer_id: USER, ownership: 'purchased', environment: 'production',
  status: 'active', total_revenue_in_usd: { gross: 12.49 }, ...overrides });
const route = (subscriptions: any[], entitlements = [{ entitlement_id: SHARED, expires_at: future() }], storeIdentifier = 'lottibaby_premium:monthly') => {
  jest.spyOn(globalThis, 'fetch').mockImplementation(async input => {
    const path = new URL(String(input)).pathname;
    if (path.endsWith('/active_entitlements')) return Response.json(list(entitlements));
    if (path.endsWith('/subscriptions')) return Response.json(list(subscriptions));
    if (path.endsWith('/products/prod-paid')) return Response.json({ id: 'prod-paid', store_identifier: storeIdentifier });
    throw new Error('unexpected URL');
  });
};
const none = { schemaVersion: 1, userId: OTHER_USER, status: 'none' };
const active = () => ({ ...none, status: 'active', sponsorId: USER, tier: 'premium', expiresAt: new Date(future()).toISOString(), validUntil: new Date(Date.now()+300000).toISOString() });
afterEach(() => jest.restoreAllMocks());
describe('paid evidence for partner sharing', () => {
  it('bridges a renewal only with a fresh provider confirmation for at most 60 seconds', async () => {
    const db = backendDb();
    route([purchased()]);
    await syncRevenueCatTier(db, USER, 'key', 'project', config, 'revenuecat_api');
    const expired = new Date(Date.now() - 1000).toISOString();
    const previous = { ...db.tables.lotti_subscription_entitlements.get(USER), expires_at: expired, paid_expires_at: expired };
    db.tables.lotti_subscription_entitlements.set(USER, previous);
    jest.restoreAllMocks();
    route([purchased({ ends_at: Date.now() - 1000 })], []);
    const startedAt = Date.now();
    const renewal = await syncRevenueCatTier(db, USER, 'key', 'project', config, 'revenuecat_api');
    expect(renewal.paid?.tier).toBe('premium');
    expect(Date.parse(renewal.paid!.expiresAt)).toBeGreaterThan(startedAt);
    expect(Date.parse(renewal.paid!.expiresAt)).toBeLessThanOrEqual(Date.now() + 60_000);
    const confirmed = { ...db.tables.lotti_subscription_entitlements.get(USER) };
    jest.mocked(fetch).mockRejectedValue(new Error('offline'));
    await expect(syncRevenueCatTier(db, USER, 'key', 'project', config, 'revenuecat_api')).rejects.toThrow('offline');
    expect(db.tables.lotti_subscription_entitlements.get(USER)).toEqual(confirmed);
    // A later coherent provider result repairs access without a renewal webhook.
    jest.restoreAllMocks();
    route([purchased()]);
    expect((await syncRevenueCatTier(db, USER, 'key', 'project', config, 'revenuecat_api')).paid?.tier).toBe('premium');
    expect(Date.parse(db.tables.lotti_subscription_entitlements.get(USER).paid_expires_at)).toBeGreaterThan(Date.now());
  });
  it.each(['app_store', 'play_store'])('refreshes just before a %s renewal without waiting for expiry', async store => {
    route([purchased({ store, ends_at: Date.now() + 20_000, auto_renewal_status: 'will_renew' })], undefined,
      store === 'app_store' ? 'lottibaby_premium_monthly' : 'lottibaby_premium:monthly');
    const startedAt = Date.now();
    const state = await fetchRevenueCatTier(USER, 'key', 'project', config);
    expect(Date.parse(state.paid!.expiresAt)).toBeGreaterThanOrEqual(startedAt + 60_000);
    expect(Date.parse(state.paid!.expiresAt)).toBeLessThanOrEqual(Date.now() + 60_000);
  });
  it('does not move the known upcoming end of a cancelled subscription', async () => {
    const end = Date.now() + 20_000;
    route([purchased({ ends_at: end, auto_renewal_status: 'will_not_renew' })]);
    expect((await fetchRevenueCatTier(USER, 'key', 'project', config)).paid?.expiresAt).toBe(new Date(end).toISOString());
  });
  it.each([{ ownership: 'family_shared' }, { status: 'trialing' }, { customer_id: OTHER_USER }, { environment: 'sandbox' }])(
    'never turns renewal continuity into payer evidence for %j', async overrides => {
      route([purchased({ ends_at: Date.now() - 1000, ...overrides })], []);
      expect((await fetchRevenueCatTier(USER, 'key', 'project', config)).paid).toBeNull();
    });
  it('accepts an explicit no-access subscription as negative even if its last grant is absent', async () => {
    route([purchased({ gives_access: false, status: 'expired' })], []);
    expect((await fetchRevenueCatTier(USER, 'key', 'project', config)).tier).toBeNull();
  });
  it('ignores subscriptions for unrelated entitlements when deciding absence', async () => {
    route([purchased({ entitlements: list([{ id: 'unrelated-entitlement' }]) })], []);
    expect((await fetchRevenueCatTier(USER, 'key', 'project', config)).tier).toBeNull();
  });
  it.each([
    ['lite', 'lottibaby_lite_monthly'],
    ['standard', 'lottibaby_monthly'],
    ['premium', 'lottibaby_premium_monthly'],
  ])('preserves Apple family-shared %s access without allowing onward sharing', async (tier, product) => {
    route([purchased({ store: 'app_store', ownership: 'family_shared', customer_id: OTHER_USER })], undefined, product);
    const db = backendDb();
    const state = await syncRevenueCatTier(db, USER, 'key', 'project', config, 'revenuecat_api');
    expect(state).toMatchObject({ tier, productId: product, paid: null });
    expect(db.tables.lotti_subscription_entitlements.get(USER)).toMatchObject({
      tier, paid_tier: null, paid_subscription_id: null,
    });
    db.tables.subscription_plan_features.set(tier, { plan_key: tier, feature_key: 'family-test-feature', enabled: true });
    expect(await verifySubscriptionFeatureAccess(db, USER, 'family-test-feature', 'key', 'project', config))
      .toEqual({ allowed: true, tier, reason: 'revenuecat' });
  });

  it.each(['app_store', 'play_store'])('accepts a real purchased subscription from %s as payer evidence', async store => {
    const product = store === 'app_store' ? 'lottibaby_premium_monthly' : 'lottibaby_premium:monthly';
    route([purchased({ store })], undefined, product);
    expect(await fetchRevenueCatTier(USER, 'key', 'project', config)).toMatchObject({
      tier: 'premium', paid: { tier: 'premium', subscriptionId: 'sub-paid' },
    });
  });

  it('stores paid evidence separately from effective/personal access', async () => {
    route([purchased()]);
    const db = backendDb();
    await syncRevenueCatTier(db, USER, 'key', 'project', config, 'revenuecat_api');
    expect(db.tables.lotti_subscription_entitlements.get(USER)).toMatchObject({ paid_tier: 'premium', paid_subscription_id: 'sub-paid' });
  });
  it.each([
    { ownership: 'family_shared' }, { ownership: undefined }, { environment: 'sandbox' }, { environment: undefined },
    { status: 'trialing' }, { status: 'unknown' }, { customer_id: OTHER_USER }, { customer_id: undefined },
    { total_revenue_in_usd: { gross: 0 } }, { total_revenue_in_usd: { gross: -2 } }, { total_revenue_in_usd: undefined },
  ])('does not share unproven or unpaid access: %j', async overrides => {
    route([purchased(overrides)]);
    expect((await fetchRevenueCatTier(USER,'key','project',config)).paid).toBeNull();
  });
  it('does not share a promotional entitlement', async () => {
    route([], [{ entitlement_id: 'ent-premium', expires_at: future() }]);
    expect(await fetchRevenueCatTier(USER,'key','project',config)).toMatchObject({ tier: 'premium', paid: null });
  });
  it('keeps cancellation active until the verified paid end', async () => {
    route([purchased({ auto_renewal_status: 'will_not_renew' })]);
    expect((await fetchRevenueCatTier(USER,'key','project',config)).paid?.tier).toBe('premium');
  });
  it('bounds a confirmed grace period and rejects billing retry', async () => {
    route([purchased({ status: 'in_grace_period', ends_at: Date.now()-1000 })]);
    const state = await fetchRevenueCatTier(USER,'key','project',config);
    expect(Date.parse(state.paid!.expiresAt)).toBeLessThanOrEqual(Date.now()+900000);
    jest.restoreAllMocks();
    route([purchased({ gives_access: false, status: 'in_billing_retry' })],[]);
    expect((await fetchRevenueCatTier(USER,'key','project',config)).paid ?? null).toBeNull();
  });
  it('clears paid evidence on refund/revocation', async () => {
    const db=backendDb(); route([purchased()]);
    await syncRevenueCatTier(db,USER,'key','project',config,'revenuecat_api');
    jest.restoreAllMocks(); route([],[]);
    await syncRevenueCatTier(db,USER,'key','project',config,'revenuecat_webhook');
    expect(db.tables.lotti_subscription_entitlements.get(USER)).toMatchObject({ paid_tier:null,paid_expires_at:null,paid_subscription_id:null });
  });
});
describe('family resolution and API authorization', () => {
  it('refreshes a nearly expired lease and re-reads membership before returning it', async () => {
    const db = backendDb(); let reads = 0;
    db.rpc.mockImplementation(async (name: string) => ({ data: name === 'account_deletion_worker' ? false :
      ++reads === 1 ? { ...active(), validUntil: new Date(Date.now() + 20_000).toISOString() } : none, error: null }));
    route([purchased()]);
    expect(await resolveFamilySubscriptionAccess(db, OTHER_USER, 'key', 'project', config)).toEqual(none);
    expect(reads).toBe(2);
  });
  it('does not resurrect a revoked lease when proactive provider verification fails', async () => {
    const db = backendDb(); let reads = 0;
    db.rpc.mockImplementation(async (name: string) => ({ data: name === 'account_deletion_worker' ? false :
      ++reads === 1 ? { ...active(), validUntil: new Date(Date.now() + 20_000).toISOString() } : none, error: null }));
    jest.spyOn(globalThis, 'fetch').mockRejectedValue(new Error('offline'));
    expect(await resolveFamilySubscriptionAccess(db, OTHER_USER, 'key', 'project', config)).toEqual(none);
    expect(reads).toBe(2);
  });
  it('rechecks membership after provider refresh, so a concurrent unlink wins', async () => {
    const db=backendDb(); let calls=0;
    db.rpc.mockImplementation(async (name: string) => ({ data: name==='account_deletion_worker' ? false : ++calls===1 ? { ...none,status:'stale',sponsorId:USER } : none,error:null }));
    route([purchased()]);
    expect(await resolveFamilySubscriptionAccess(db,OTHER_USER,'key','project',config)).toEqual(none);
    expect(calls).toBe(2);
  });
  it('does not convert a provider outage into a negative family result', async () => {
    const db=backendDb();
    db.rpc.mockImplementation(async (name: string) => ({data:name==='account_deletion_worker'?false:{...none,status:'stale',sponsorId:USER},error:null}));
    jest.spyOn(globalThis,'fetch').mockResolvedValue(new Response('',{status:503}));
    await expect(resolveFamilySubscriptionAccess(db,OTHER_USER,'key','project',config)).rejects.toThrow('revenuecat_503');
  });
  it('uses family Premium for feature checks when own tier is Lite', async () => {
    const db=backendDb();
    db.tables.lotti_subscription_entitlements.set(OTHER_USER,{user_id:OTHER_USER,tier:'lite',expires_at:new Date(future()).toISOString(),checked_at:new Date().toISOString()});
    db.tables.subscription_plan_features.set('lite',{feature_key:'fragLotti',plan_key:'lite',enabled:false});
    db.tables.subscription_plan_features.set('premium',{feature_key:'fragLotti',plan_key:'premium',enabled:true});
    db.rpc.mockImplementation(async (name: string)=>({data:name==='account_deletion_worker'?false:active(),error:null}));
    expect(await verifySubscriptionFeatureAccess(db,OTHER_USER,'fragLotti',undefined,undefined,config)).toEqual({allowed:true,reason:'family_subscription',tier:'premium'});
  });
  it('authenticates the caller and strips payer identity from the response', async () => {
    const resolve=jest.fn().mockResolvedValue(active());
    const admin={auth:{getUser:jest.fn().mockResolvedValue({data:{user:{id:OTHER_USER}},error:null})}};
    const handler=createFamilyAccessHandler({env:()=> 'configured',createAdmin:()=>admin,resolve});
    const response=await handler(new Request('https://test',{method:'POST',headers:{authorization:'Bearer token'},body:JSON.stringify({userId:USER,tier:'premium'})}));
    expect(response.status).toBe(200);
    expect(await response.json()).not.toHaveProperty('sponsorId');
    expect(resolve.mock.calls[0][1]).toBe(OTHER_USER);
    expect((await handler(new Request('https://test',{method:'POST'}))).status).toBe(401);
    admin.auth.getUser.mockResolvedValue({data:{user:null},error:{message:'invalid'}} as any);
    expect((await handler(new Request('https://test',{method:'POST',headers:{authorization:'Bearer bad'}}))).status).toBe(401);
  });
  it('protects scheduled repair and reports failed refreshes without extending evidence', async () => {
    const sync=jest.fn().mockRejectedValue(new Error('provider unavailable'));
    const admin={rpc:jest.fn().mockResolvedValue({data:[USER],error:null})};
    const handler=createReconcileHandler({env:()=> 'configured',createAdmin:()=>admin,sync});
    expect((await handler(new Request('https://test',{method:'POST'}))).status).toBe(401);
    const response=await handler(new Request('https://test',{method:'POST',headers:{authorization:'Bearer configured'}}));
    expect(response.status).toBe(503);
    expect(await response.json()).toEqual({checked:1,failed:1});
  });
});
