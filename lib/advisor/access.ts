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
 * Seit dem Premium-Abomodell schaltet zusätzlich das Premium-Tier frei
 * (lib/entitlements.ts). isPro reicht NICHT — das gilt für alle Abos.
 */

import { getCachedUserProfile } from '@/lib/appCache';
import { hasFeatureAccess } from '@/lib/entitlements';
import { usePremiumFeatureAccess } from '@/lib/premiumFeatureAccess';

export const fetchAdvisorAccess = async (): Promise<boolean> => {
  try {
    const profile = await getCachedUserProfile();
    if (
      profile?.is_admin === true ||
      profile?.paywall_access_role === 'premium_tester'
    ) {
      return true;
    }
  } catch {
    // Profil nicht verfügbar → weiter mit Tier-Prüfung
  }

  try {
    return await hasFeatureAccess('fuersorge');
  } catch {
    return false;
  }
};

/**
 * true = darf das Feature sehen, false = nicht, null = wird noch geprüft.
 * Wird bei jedem Fokus neu geladen (Rolle kann sich serverseitig ändern).
 */
export const useAdvisorAccess = (): boolean | null => {
  return usePremiumFeatureAccess('fuersorge');
};
