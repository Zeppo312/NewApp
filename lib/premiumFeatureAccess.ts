import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { useAuth } from '@/contexts/AuthContext';
import { useSubscriptionAccess } from '@/contexts/SubscriptionAccessContext';
import { getCachedUserProfile } from '@/lib/appCache';
import { featureAllowedByPolicy, type AppFeature } from '@/lib/subscriptionFeaturePolicy';

/** Keep one-time profile roles and changing subscription tiers in the same UI decision. */
export function usePremiumFeatureAccess(feature: AppFeature): boolean | null {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const subscription = useSubscriptionAccess();
  const [role, setRole] = useState<{ userId: string; allowed: boolean } | null>(null);

  useFocusEffect(useCallback(() => {
    if (!userId) return;
    let active = true;
    void getCachedUserProfile()
      .then(profile => {
        if (active) setRole({
          userId,
          allowed: profile?.is_admin === true || profile?.paywall_access_role === 'premium_tester',
        });
      })
      .catch(() => { if (active) setRole({ userId, allowed: false }); });
    return () => { active = false; };
  }, [userId]));

  if (!userId) return false;
  if (role?.userId === userId && role.allowed) return true;
  if (role?.userId !== userId || subscription.userId !== userId) return null;
  return featureAllowedByPolicy(subscription.policy, feature, subscription.tier);
}
