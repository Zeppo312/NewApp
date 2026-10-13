import { supabase } from './supabase';
import { getRevenueCatEntitlementStatus, getRevenueCatStartupEvidence } from './revenuecat';
import { refreshFamilyAccess, getFamilyAccessVerifiedAt } from './familySubscriptionAccess';
import { isPaywallAccessRole } from './paywallAccess';
import { STARTUP_ACCESS_MAX_AGE_MS, type StartupAccessEvidence } from './startupAccess';
import { Platform } from 'react-native';

export type StartupAccessCheck = { status: 'allowed'; evidence: StartupAccessEvidence }
  | { status: 'denied' | 'unavailable' };

/** Fresh auth/profile checks plus the provider's original verification time.
 * A cached positive provider result may retain continuity, never renew it. */
export async function verifyStartupAccess(userId: string, signal: AbortSignal): Promise<StartupAccessCheck> {
  const { data, error } = await supabase.auth.getUser();
  if (signal.aborted) return { status: 'unavailable' };
  if (error) return { status: error.code === 'user_not_found' || error.code === 'session_not_found' ? 'denied' : 'unavailable' };
  if (!data.user) return { status: 'denied' };
  if (data.user.id !== userId) return { status: 'unavailable' };
  const ownRequest = getRevenueCatEntitlementStatus(userId).catch(error => ({ status: 'unavailable' as const, error }));
  const profileResult = await supabase.from('profiles').select('id,is_admin,paywall_access_role').eq('id', userId).abortSignal(signal).maybeSingle();
  if (signal.aborted) return { status: 'unavailable' };
  const profile = profileResult.data;
  if (!profileResult.error && profile?.id === userId) {
    const accessReason = profile.is_admin === true ? 'admin' : isPaywallAccessRole(profile.paywall_access_role) ? profile.paywall_access_role : null;
    if (accessReason) return { status: 'allowed', evidence: { accessReason, verifiedAt: Date.now(), subscriptionExpiresAt: null } };
  }
  const own = await ownRequest;
  if (signal.aborted) return { status: 'unavailable' };
  if (own.status === 'active') {
    const evidence = getRevenueCatStartupEvidence(own.customerInfo);
    if (evidence && Date.now() - evidence.verifiedAt < STARTUP_ACCESS_MAX_AGE_MS) {
      return { status: 'allowed', evidence: { accessReason: 'subscription', ...evidence } };
    }
  }
  const family = await refreshFamilyAccess(userId);
  if (signal.aborted) return { status: 'unavailable' };
  if (family.status === 'active') {
    const verifiedAt = getFamilyAccessVerifiedAt(userId);
    return verifiedAt ? { status: 'allowed', evidence: { accessReason: 'family_subscription', verifiedAt,
      subscriptionExpiresAt: Date.parse(family.expiresAt) } } : { status: 'unavailable' };
  }
  // A failed lookup cannot establish the absence of another valid access path.
  const ownCheckedAt = own.status === 'inactive' ? Date.parse(own.customerInfo?.requestDate) : NaN;
  const ownAbsenceConfirmed = own.status === 'inactive' && (Platform.OS === 'web'
    || (Number.isFinite(ownCheckedAt) && ownCheckedAt <= Date.now() && Date.now() - ownCheckedAt < 5 * 60_000));
  return profileResult.error || (profile && profile.id !== userId) || !ownAbsenceConfirmed || family.status === 'unavailable'
    ? { status: 'unavailable' } : { status: 'denied' };
}
