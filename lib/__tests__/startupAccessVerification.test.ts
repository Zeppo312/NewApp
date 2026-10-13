import { Platform } from 'react-native';
import { supabase } from '../supabase';
import { getRevenueCatEntitlementStatus } from '../revenuecat';
import { refreshFamilyAccess } from '../familySubscriptionAccess';
import { verifyStartupAccess } from '../startupAccessVerification';
jest.mock('../supabase', () => ({ supabase: { auth: { getUser: jest.fn() }, from: jest.fn() } }));
jest.mock('../revenuecat', () => ({ getRevenueCatEntitlementStatus: jest.fn(), getRevenueCatStartupEvidence: (info: any) => info.evidence ?? null }));
jest.mock('../familySubscriptionAccess', () => ({ refreshFamilyAccess: jest.fn(), getFamilyAccessVerifiedAt: () => Date.now() - 60_000 }));
const own = jest.mocked(getRevenueCatEntitlementStatus);
const family = jest.mocked(refreshFamilyAccess);
let profile: any;
let profileError: any;
const check = () => verifyStartupAccess('A', new AbortController().signal);
const originalOS = Platform.OS;
beforeEach(() => {
  jest.clearAllMocks(); Platform.OS = 'ios'; profile = { id: 'A' }; profileError = null;
  jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'A' } }, error: null } as any);
  jest.mocked(supabase.from).mockImplementation(() => ({ select: () => ({ eq: () => ({ abortSignal: () => ({ maybeSingle: async () => ({ data: profile, error: profileError }) }) }) }) }) as any);
  own.mockResolvedValue({ status: 'inactive', customerInfo: { requestDate: new Date().toISOString() } });
  family.mockResolvedValue({ status: 'none', userId: 'A' });
});
afterEach(() => { Platform.OS = originalOS; });
it.each(['admin', 'tester', 'premium_tester', 'lite_tester', 'cooperation_partner'] as const)('confirms %s from a fresh account-scoped profile even while the provider hangs', async accessReason => {
  profile = { id: 'A', is_admin: accessReason === 'admin', paywall_access_role: accessReason === 'admin' ? null : accessReason };
  own.mockReturnValue(new Promise(() => {}));
  expect(await check()).toEqual({ status: 'allowed', evidence: { accessReason, verifiedAt: expect.any(Number), subscriptionExpiresAt: null } });
});
it('does not infer logout or entitlement loss from failed or mismatched auth', async () => {
  jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: new Error('offline') } as any);
  expect(await check()).toEqual({ status: 'unavailable' });
  jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: { id: 'B' } }, error: null } as any);
  expect(await check()).toEqual({ status: 'unavailable' }); expect(own).not.toHaveBeenCalled();
});
it.each(['user_not_found', 'session_not_found'])('honors the explicit Auth-server revocation %s', async code => {
  jest.mocked(supabase.auth.getUser).mockResolvedValue({ data: { user: null }, error: { code } } as any);
  expect(await check()).toEqual({ status: 'denied' });
});
it('revokes only when all possible access paths are confirmed absent', async () => {
  expect(await check()).toEqual({ status: 'denied' });
  profileError = new Error('offline'); expect(await check()).toEqual({ status: 'unavailable' });
  profileError = null; family.mockResolvedValue({ status: 'unavailable', userId: 'A' });
  expect(await check()).toEqual({ status: 'unavailable' });
});
it('never treats stale negative provider information as confirmed revocation', async () => {
  own.mockResolvedValue({ status: 'inactive', customerInfo: { requestDate: new Date(Date.now() - 600_000).toISOString() } });
  expect(await check()).toEqual({ status: 'unavailable' });
});
it('retains the original provider verification date instead of extending cached evidence', async () => {
  const evidence = { verifiedAt: Date.now() - 3_600_000, subscriptionExpiresAt: Date.now() + 3_600_000 };
  own.mockResolvedValue({ status: 'active', customerInfo: { evidence } });
  expect(await check()).toEqual({ status: 'allowed', evidence: { accessReason: 'subscription', ...evidence } });
  expect(family).not.toHaveBeenCalled();
});
it('can use a valid family grant when own provider evidence is missing or older than 24 hours', async () => {
  own.mockResolvedValue({ status: 'active', customerInfo: { evidence: { verifiedAt: Date.now() - 25 * 3_600_000, subscriptionExpiresAt: null } } });
  family.mockResolvedValue({ status: 'active', userId: 'A', tier: 'premium', validUntil: Date.now() + 60_000, expiresAt: new Date(Date.now() + 3_600_000).toISOString() });
  expect(await check()).toMatchObject({ status: 'allowed', evidence: { accessReason: 'family_subscription', verifiedAt: expect.any(Number) } });
});
it('discards a verification whose caller has already timed out or changed account', async () => {
  const controller = new AbortController(); controller.abort();
  expect(await verifyStartupAccess('A', controller.signal)).toEqual({ status: 'unavailable' });
  expect(supabase.from).not.toHaveBeenCalled();
});
