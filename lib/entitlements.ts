/**
 * Abo-Tiers & Feature-Gating.
 *
 * Drei Stufen:
 *   - lite:     eingeschränkte Basis (neue lottibaby_lite_*-Produkte)
 *   - standard: alles ohne KI (Bestandskunden mit lottibaby_monthly/yearly)
 *   - premium:  Standard + KI-Features (lottibaby_premium_*-Produkte)
 *
 * Die Tier-Auflösung läuft über die RevenueCat-Produkt-IDs (Naming bleibt
 * unverändert). Solange die neuen Produkte/Entitlements in RevenueCat noch
 * nicht verknüpft sind, kann über MOCK_SUBSCRIPTION_TIER bzw. die Env-Variable
 * EXPO_PUBLIC_MOCK_SUBSCRIPTION_TIER ein Tier simuliert werden.
 */

import { useCallback, useState } from 'react';
import { useFocusEffect } from 'expo-router';

import { getCachedUserProfile } from '@/lib/appCache';
import { getCachedUser } from '@/lib/supabase';
import {
  getRevenueCatSubscriptionSummary,
  getTierFromProductId,
} from '@/lib/revenuecat';

export type AppSubscriptionTier = 'lite' | 'standard' | 'premium';

/**
 * Mock-Override für Entwicklung/Tests, solange RevenueCat noch nicht auf die
 * neuen Produkte umgestellt ist. Entweder hier hart setzen (z. B. 'lite')
 * oder per EXPO_PUBLIC_MOCK_SUBSCRIPTION_TIER=lite starten. null = echte
 * Auflösung über RevenueCat.
 */
export const MOCK_SUBSCRIPTION_TIER: AppSubscriptionTier | null = null;

const parseTier = (value: string | null | undefined): AppSubscriptionTier | null =>
  value === 'lite' || value === 'standard' || value === 'premium' ? value : null;

const getMockTier = (): AppSubscriptionTier | null =>
  MOCK_SUBSCRIPTION_TIER ??
  parseTier(process.env.EXPO_PUBLIC_MOCK_SUBSCRIPTION_TIER);

export type AppFeature =
  | 'basisTracker'
  | 'partnerLink'
  | 'planner'
  | 'shoppingList'
  | 'wochenmomente'
  | 'pdfExport'
  | 'recipes'
  | 'fullHistory'
  | 'voiceLog'
  | 'fuersorge';

const FEATURE_MATRIX: Record<AppFeature, AppSubscriptionTier[]> = {
  basisTracker: ['lite', 'standard', 'premium'],
  partnerLink: ['standard', 'premium'],
  planner: ['standard', 'premium'],
  shoppingList: ['standard', 'premium'],
  wochenmomente: ['standard', 'premium'],
  pdfExport: ['standard', 'premium'],
  recipes: ['standard', 'premium'],
  fullHistory: ['standard', 'premium'],
  // KI-Features – nur Premium
  voiceLog: ['premium'],
  fuersorge: ['premium'],
};

/** Lite sieht nur die letzten N Tage Verlauf (heute eingeschlossen). */
export const LITE_HISTORY_DAYS = 7;

const startOfDay = (date: Date): Date => {
  const next = new Date(date);
  next.setHours(0, 0, 0, 0);
  return next;
};

/**
 * Frühestes Datum, das im aktuellen Tier noch angesehen werden darf.
 * null = unbegrenzter Verlauf.
 */
export const getHistoryCutoffDate = (
  tier: AppSubscriptionTier | null,
): Date | null => {
  if (tier !== 'lite') return null;
  const cutoff = startOfDay(new Date());
  cutoff.setDate(cutoff.getDate() - (LITE_HISTORY_DAYS - 1));
  return cutoff;
};

export const isBeforeHistoryCutoff = (
  date: Date,
  cutoff: Date | null,
): boolean => cutoff !== null && startOfDay(date).getTime() < cutoff.getTime();

/**
 * Cutoff-Datum für Verlaufsansichten; null solange geprüft wird oder das
 * Tier unbegrenzten Verlauf hat.
 */
export const useHistoryCutoff = (): Date | null => {
  const tier = useSubscriptionTier();
  return getHistoryCutoffDate(tier);
};

export type LockedFeatureCopy = {
  title: string;
  subtitle: string;
  bullets: string[];
  /** Tier, das das Feature freischaltet – steuert die CTA-Beschriftung. */
  requiredTier: 'standard' | 'premium';
};

export const LOCKED_FEATURE_COPY: Record<AppFeature, LockedFeatureCopy> = {
  basisTracker: {
    title: 'Basis-Tracker',
    subtitle: 'In jedem Lotti-Abo enthalten.',
    bullets: [],
    requiredTier: 'standard',
  },
  partnerLink: {
    title: 'Gemeinsam als Familie',
    subtitle:
      'Verknüpfe dein Konto mit deinem Partner – beide sehen und tracken dasselbe Baby.',
    bullets: [
      'Einträge landen sofort bei euch beiden',
      'Wer übernimmt die Nacht? Ihr seht beide den Stand',
      'Benachrichtigungen für den Partner',
    ],
    requiredTier: 'standard',
  },
  planner: {
    title: 'Planer & Termine',
    subtitle: 'Behaltet Arzttermine, U-Untersuchungen und euren Alltag im Blick.',
    bullets: [
      'Gemeinsamer Familienkalender',
      'Erinnerungen an wichtige Termine',
      'Synchron mit deinem Partner',
    ],
    requiredTier: 'standard',
  },
  shoppingList: {
    title: 'Einkaufslisten',
    subtitle: 'Windeln fast leer? Einmal eintragen, beide sehen es.',
    bullets: [
      'Geteilte Listen für euch beide',
      'Vorrats-Erinnerungen bei niedrigem Bestand',
      'Vorlagen für Baby-Erstausstattung',
    ],
    requiredTier: 'standard',
  },
  wochenmomente: {
    title: 'Wochenmomente',
    subtitle: 'Sammle jede Woche einen besonderen Moment eures Babys.',
    bullets: [
      'Wöchentliche Erinnerungs-Sammlung',
      'Eure Geschichte zum Zurückblättern',
      'Momente mit dem Partner teilen',
    ],
    requiredTier: 'standard',
  },
  pdfExport: {
    title: 'Auswertungen & PDF-Export',
    subtitle: 'Alle Daten übersichtlich – auch für den Kinderarzt.',
    bullets: [
      'PDF-Berichte für U-Untersuchungen',
      'Schlaf- und Fütter-Auswertungen',
      'Daten gehören euch – jederzeit exportierbar',
    ],
    requiredTier: 'standard',
  },
  recipes: {
    title: 'Rezepte & Beikost',
    subtitle: 'Rezeptideen und Beikost-Begleitung für euer Baby.',
    bullets: [
      'Altersgerechte Rezeptideen',
      'Eigene Rezepte speichern',
      'Beikost-Videokurs',
    ],
    requiredTier: 'standard',
  },
  fullHistory: {
    title: 'Kompletter Verlauf',
    subtitle:
      'In Lotti Lite siehst du die letzten 7 Tage – mit einem Abo bleibt eure ganze Geschichte erreichbar.',
    bullets: [
      'Alle Einträge seit dem ersten Tag',
      'Entwicklungen über Wochen und Monate verfolgen',
      'Nichts geht verloren – deine Daten bleiben gespeichert',
    ],
    requiredTier: 'standard',
  },
  voiceLog: {
    title: 'Sprach-Logging',
    subtitle:
      'Einfach einsprechen – Lotti trägt Stillen, Schlafen & Wickeln für dich ein.',
    bullets: [
      'Nachts mit einer Hand bedienbar',
      'Lotti versteht dich und ordnet alles richtig zu',
      'Ein KI-Feature aus Lotti Premium',
    ],
    requiredTier: 'premium',
  },
  fuersorge: {
    title: 'Lottis Fürsorge',
    subtitle:
      'Tägliche, persönliche Hinweise für euch – aus Wetter, Alter und euren Daten.',
    bullets: [
      'UV-, Regen- und Temperatur-Hinweise für euer Baby',
      'Persönliche Impulse statt generischer Tipps',
      'Ein KI-Feature aus Lotti Premium',
    ],
    requiredTier: 'premium',
  },
};

/**
 * Tier-Auflösung:
 *   1. Mock-Override (Entwicklung, solange RevenueCat nicht verknüpft ist)
 *   2. Admins & Premiumtester → premium (wie bisher bei den KI-Features)
 *   3. Tester/Kooperationspartner → standard (Sonderzugang wie bisher: alles
 *      außer KI — KI war schon vorher Premiumtester-only)
 *   4. Aktives Abo → Tier aus der Produkt-ID
 *   5. Kein Abo (Trial) → standard: die Testphase zeigt die volle App ohne
 *      KI, damit das KI-Budget hinter dem Premium-Abo bleibt
 */
export const resolveSubscriptionTier = async (): Promise<AppSubscriptionTier> => {
  const mockTier = getMockTier();
  if (mockTier) return mockTier;

  try {
    const profile = await getCachedUserProfile();
    if (
      profile?.is_admin === true ||
      profile?.paywall_access_role === 'premium_tester'
    ) {
      return 'premium';
    }
    if (
      profile?.paywall_access_role === 'tester' ||
      profile?.paywall_access_role === 'cooperation_partner'
    ) {
      return 'standard';
    }
  } catch {
    // Profil nicht verfügbar → weiter mit Abo-Prüfung
  }

  try {
    const { data: userData } = await getCachedUser();
    const userId = userData.user?.id;
    if (!userId) return 'standard';

    const summary = await getRevenueCatSubscriptionSummary(userId);
    if (summary.isActive) {
      const tier = getTierFromProductId(summary.productId);
      if (tier === 'lite') return 'lite';
      if (tier === 'premium') {
        // Legacy-Produkte zählen als Standard (alles ohne KI); nur die neuen
        // lottibaby_premium_*-Produkte schalten KI frei.
        return summary.productId?.startsWith('lottibaby_premium')
          ? 'premium'
          : 'standard';
      }
      // Aktives, aber unbekanntes Produkt → sichere Mitte
      return 'standard';
    }
  } catch {
    // RevenueCat nicht erreichbar/konfiguriert → Trial-Verhalten
  }

  return 'standard';
};

let tierCache: { tier: AppSubscriptionTier; at: number } | null = null;
const TIER_CACHE_TTL_MS = 5 * 60 * 1000;

export const invalidateSubscriptionTierCache = () => {
  tierCache = null;
};

export const getSubscriptionTier = async (): Promise<AppSubscriptionTier> => {
  if (tierCache && Date.now() - tierCache.at < TIER_CACHE_TTL_MS) {
    return tierCache.tier;
  }

  const tier = await resolveSubscriptionTier();
  tierCache = { tier, at: Date.now() };
  return tier;
};

export const hasFeatureAccess = async (feature: AppFeature): Promise<boolean> => {
  const tier = await getSubscriptionTier();
  return FEATURE_MATRIX[feature].includes(tier);
};

export const featureAllowedForTier = (
  feature: AppFeature,
  tier: AppSubscriptionTier,
): boolean => FEATURE_MATRIX[feature].includes(tier);

export type FeatureAccessState = {
  /** null = wird noch geprüft */
  hasAccess: boolean | null;
  tier: AppSubscriptionTier | null;
};

/**
 * Prüft den Zugriff bei jedem Fokus neu (Abo/Rolle kann sich ändern).
 */
export const useFeatureAccess = (feature: AppFeature): FeatureAccessState => {
  const [state, setState] = useState<FeatureAccessState>({
    hasAccess: null,
    tier: null,
  });

  useFocusEffect(
    useCallback(() => {
      let active = true;

      void getSubscriptionTier().then((tier) => {
        if (!active) return;
        setState({
          hasAccess: featureAllowedForTier(feature, tier),
          tier,
        });
      });

      return () => {
        active = false;
      };
    }, [feature]),
  );

  return state;
};

export const useSubscriptionTier = (): AppSubscriptionTier | null => {
  const [tier, setTier] = useState<AppSubscriptionTier | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      void getSubscriptionTier().then((resolved) => {
        if (active) setTier(resolved);
      });
      return () => {
        active = false;
      };
    }, []),
  );

  return tier;
};
