/**
 * Lottis Fürsorge – Zugriffskontrolle.
 *
 * Das Feature ist in Erprobung und aktuell nur sichtbar für:
 *   - Admins (profiles.is_admin)
 *   - Premiumtester (profiles.paywall_access_role = 'premium_tester')
 *
 * Bewusst nur über das (gecachte) Profil geprüft — nicht über den
 * kompletten Paywall-State: Der hängt zusätzlich am Abo-Status, und ein
 * Fehler dort soll Admins/Testern nicht die Kachel wegnehmen.
 *
 * TODO(Premium-Abo): Sobald das neue Premium-Abomodell existiert, hier
 * zusätzlich das Premium-Entitlement freischalten (isPro reicht dann
 * NICHT — das gilt für alle Abos; es braucht den Premium-Tier-Check).
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getCachedUserProfile } from '@/lib/appCache';

export const fetchAdvisorAccess = async (): Promise<boolean> => {
  try {
    const profile = await getCachedUserProfile();
    return (
      profile?.is_admin === true ||
      profile?.paywall_access_role === 'premium_tester'
    );
  } catch {
    return false;
  }
};

/**
 * true = darf das Feature sehen, false = nicht, null = wird noch geprüft.
 * Wird bei jedem Fokus neu geladen (Rolle kann sich serverseitig ändern).
 */
export const useAdvisorAccess = (): boolean | null => {
  const [access, setAccess] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchAdvisorAccess().then((allowed) => {
        if (active) setAccess(allowed);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return access;
};
