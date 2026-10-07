jest.mock('../supabase', () => ({
  supabase: { auth: { getSession: jest.fn() }, rpc: jest.fn(), functions: { invoke: jest.fn() } },
}));
import { supabase } from '../supabase';
import {
  parseFamilyAccess, refreshFamilyAccess, getCachedFamilyAccess, clearFamilyAccess,
  invalidateFamilyAccess, checkFamilyPurchaseAccess, subscribeToFamilyAccess, resetFamilyAccessForTests,
} from '../familySubscriptionAccess';

const rpc = jest.mocked(supabase.rpc);
const now = Date.parse('2026-09-12T12:00:00Z');
const active = (tier = 'premium') => ({
  schemaVersion: 1, userId: 'partner', status: 'active', tier,
  expiresAt: '2026-10-12T12:00:00Z', validUntil: new Date(now + 300_000).toISOString(),
});
const respond = (data: unknown, error: unknown = null) => {
  rpc.mockReturnValue({ abortSignal: jest.fn().mockResolvedValue({ data, error }) } as any);
};

describe('family subscription server access', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(now);
    resetFamilyAccessForTests();
    jest.clearAllMocks();
    jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: { user: { id: 'partner' } } }, error: null } as any);
  });
  afterEach(() => { clearFamilyAccess(); jest.useRealTimers(); });

  it.each(['lite', 'standard', 'premium'])('accepts a bounded %s grant for the authenticated account', async tier => {
    respond(active(tier));
    await expect(refreshFamilyAccess('partner')).resolves.toMatchObject({ status: 'active', tier });
    expect(rpc).toHaveBeenCalledWith('get_family_subscription_access');
  });

  it('rejects other accounts, invalid tiers, missing and expired leases', () => {
    for (const change of [{ userId: 'buyer' }, { tier: 'admin' }, { validUntil: null },
      { validUntil: new Date(now).toISOString() }, { expiresAt: new Date(now - 1).toISOString() }]) {
      expect(parseFamilyAccess({ ...active(), ...change }, 'partner').status).toBe('unavailable');
    }
    expect(parseFamilyAccess({ ...active(), validUntil: active().expiresAt }, 'partner')).toMatchObject({ validUntil: now + 300_000 });
  });

  it('coalesces concurrent checks and rejects a request after the link was removed', async () => {
    let finish!: (value: unknown) => void;
    rpc.mockReturnValue({ abortSignal: () => new Promise(resolve => { finish = resolve; }) } as any);
    const first = refreshFamilyAccess('partner');
    const second = refreshFamilyAccess('partner', { force: true });
    await Promise.resolve();
    invalidateFamilyAccess('partner');
    finish({ data: active(), error: null });
    expect((await first).status).toBe('unavailable');
    expect((await second).status).toBe('unavailable');
    expect(getCachedFamilyAccess('partner').status).toBe('unavailable');
    expect(rpc).toHaveBeenCalledTimes(1);
  });

  it('does not extend offline access and notifies the app at lease expiry', async () => {
    respond(active());
    await refreshFamilyAccess('partner');
    jest.advanceTimersByTime(120_000);
    respond(null, { code: 'NETWORK' });
    expect(await refreshFamilyAccess('partner', { force: true })).toMatchObject({ status: 'active', validUntil: now + 300_000 });
    const notify = jest.fn();
    const unsubscribe = subscribeToFamilyAccess(notify);
    jest.advanceTimersByTime(180_000);
    expect(getCachedFamilyAccess('partner').status).toBe('unavailable');
    expect(notify).toHaveBeenCalledWith('partner');
    unsubscribe();
  });

  it('revokes confirmed access immediately and does not resurrect it after an outage', async () => {
    respond(active());
    await refreshFamilyAccess('partner');
    respond({ schemaVersion: 1, userId: 'partner', status: 'none' });
    expect((await refreshFamilyAccess('partner', { force: true })).status).toBe('none');
    respond(null, { code: 'NETWORK' });
    expect((await refreshFamilyAccess('partner', { force: true })).status).toBe('unavailable');
  });

  it('allows the legacy checkout only for a missing RPC, not a permission or network error', async () => {
    respond(null, { code: 'PGRST202' });
    expect(await checkFamilyPurchaseAccess('partner')).toBe('allowed');
    respond(null, { code: '42501' });
    expect(await checkFamilyPurchaseAccess('partner')).toBe('unavailable');
    respond(active());
    expect(await checkFamilyPurchaseAccess('partner')).toBe('family');
  });

  it('requires a matching signed-in account and clears access on logout', async () => {
    respond(active());
    await refreshFamilyAccess('partner');
    clearFamilyAccess();
    jest.mocked(supabase.auth.getSession).mockResolvedValue({ data: { session: null }, error: null });
    expect((await refreshFamilyAccess('partner')).status).toBe('unavailable');
    expect(getCachedFamilyAccess('partner').status).toBe('unavailable');
  });

  it('ends a hung request and allows a later retry', async () => {
    rpc.mockReturnValue({ abortSignal: () => new Promise(() => {}) } as any);
    const pending = refreshFamilyAccess('partner');
    await jest.advanceTimersByTimeAsync(8_000);
    expect((await pending).status).toBe('unavailable');
    respond(active());
    expect((await refreshFamilyAccess('partner', { force: true })).status).toBe('active');
  });

  it('refreshes stale server evidence through the authenticated Edge endpoint', async () => {
    respond(null, { code: 'P0001', message: 'family_verification_required' });
    jest.mocked(supabase.functions.invoke).mockResolvedValue({ data: active(), error: null });
    expect((await refreshFamilyAccess('partner')).status).toBe('active');
    expect(supabase.functions.invoke).toHaveBeenCalledWith('family-subscription-access', {
      body: {}, signal: expect.any(AbortSignal),
    });
  });

  it('blocks checkout when refreshing paid evidence fails', async () => {
    respond(null, { code: 'P0001', message: 'family_verification_required' });
    jest.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: new Error('offline') });
    expect(await checkFamilyPurchaseAccess('partner')).toBe('unavailable');
  });

  it('renews a short lease before expiry even inside the normal cache interval', async () => {
    const lease = { ...active(), validUntil: new Date(now + 60_000).toISOString() };
    respond(lease);
    await refreshFamilyAccess('partner');
    await jest.advanceTimersByTimeAsync(30_000);
    jest.mocked(supabase.functions.invoke).mockResolvedValue({
      data: { ...active(), validUntil: new Date(now + 90_000).toISOString() }, error: null,
    });
    expect(await refreshFamilyAccess('partner')).toMatchObject({ status: 'active', validUntil: now + 90_000 });
    expect(supabase.functions.invoke).toHaveBeenCalledTimes(1);
    await jest.advanceTimersByTimeAsync(30_000);
    expect(getCachedFamilyAccess('partner').status).toBe('active');
  });

  it('expires a short renewal lease after a failed proactive check', async () => {
    respond({ ...active(), validUntil: new Date(now + 60_000).toISOString() });
    await refreshFamilyAccess('partner');
    await jest.advanceTimersByTimeAsync(30_000);
    jest.mocked(supabase.functions.invoke).mockResolvedValue({ data: null, error: new Error('offline') });
    expect(await refreshFamilyAccess('partner')).toMatchObject({ status: 'active', validUntil: now + 60_000 });
    await jest.advanceTimersByTimeAsync(30_000);
    expect(getCachedFamilyAccess('partner').status).toBe('unavailable');
    expect(await checkFamilyPurchaseAccess('partner')).toBe('unavailable');
  });

  it('does not treat a disappeared endpoint as a fresh rollout after it has been used', async () => {
    respond({ schemaVersion: 1, userId: 'partner', status: 'none' });
    await refreshFamilyAccess('partner');
    respond(null, { code: 'PGRST202' });
    expect(await checkFamilyPurchaseAccess('partner')).toBe('unavailable');
  });
});
