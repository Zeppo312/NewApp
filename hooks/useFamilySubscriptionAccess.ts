import { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { getCachedFamilyAccess, refreshFamilyAccess, subscribeToFamilyAccess } from '@/lib/familySubscriptionAccess';

export function useFamilySubscriptionAccess() {
  const { user } = useAuth();
  const userId = user?.id;
  const [, update] = useState(0);
  useEffect(() => {
    if (!userId) return;
    const unsubscribe = subscribeToFamilyAccess(changed => { if (changed === userId) update(value => value + 1); });
    void refreshFamilyAccess(userId);
    return unsubscribe;
  }, [userId]);
  return userId ? getCachedFamilyAccess(userId) : null;
}
