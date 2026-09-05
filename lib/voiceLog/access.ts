/**
 * Sprach-Logging – Zugriffskontrolle.
 *
 * Premium-Feature, in Erprobung aktuell nur sichtbar für:
 *   - Admins (profiles.is_admin)
 *   - Premiumtester (profiles.paywall_access_role = 'premium_tester')
 *
 * Bewusst nur über das (gecachte) Profil geprüft — nicht über den
 * kompletten Paywall-State: Der hängt zusätzlich am Abo-Status, und ein
 * Fehler dort soll Admins/Testern nicht das Feature wegnehmen.
 *
 * Seit dem Premium-Abomodell schaltet zusätzlich das Premium-Tier frei
 * (lib/entitlements.ts). isPro reicht NICHT — das gilt für alle Abos.
 * Serverseitig gilt dieselbe Prüfung in supabase/functions/voice-log-parse;
 * dort muss der Premium-Tier-Check noch nachgezogen werden, sobald die
 * RevenueCat-Produkte verknüpft sind.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getCachedUserProfile } from '@/lib/appCache';
import { hasFeatureAccess } from '@/lib/entitlements';

export const fetchVoiceLogAccess = async (): Promise<boolean> => {
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
    return await hasFeatureAccess('voiceLog');
  } catch {
    return false;
  }
};

/**
 * true = darf das Feature sehen, false = nicht, null = wird noch geprüft.
 * Wird bei jedem Fokus neu geladen (Rolle kann sich serverseitig ändern).
 */
export const useVoiceLogAccess = (): boolean | null => {
  const [access, setAccess] = useState<boolean | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      fetchVoiceLogAccess().then((allowed) => {
        if (active) setAccess(allowed);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return access;
};
