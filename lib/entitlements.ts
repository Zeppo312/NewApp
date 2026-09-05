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
 * nicht verknüpft sind, kann über EXPO_PUBLIC_MOCK_SUBSCRIPTION_TIER ein Tier
 * simuliert werden.
 */

import { useSubscriptionAccess } from "@/contexts/SubscriptionAccessContext";
import {
  getSubscriptionAccessState,
  markSubscriptionAccessStale,
  refreshCurrentSubscriptionAccess,
} from "@/lib/subscriptionAccess";
import {
  featureAllowedByPolicy,
  getCurrentSubscriptionFeaturePolicy,
  type AppFeature,
  type AppSubscriptionTier,
} from "@/lib/subscriptionFeaturePolicy";

export type {
  AppFeature,
  AppSubscriptionTier,
} from "@/lib/subscriptionFeaturePolicy";

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
  if (tier !== "lite") return null;
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
  const access = useFeatureAccess("fullHistory");
  // Während der lokale Stand initialisiert wird, niemals vorsorglich sperren.
  // Erst eine gültige Policy-Entscheidung aktiviert das 7-Tage-Limit.
  if (access.hasAccess !== false) return null;

  const cutoff = startOfDay(new Date());
  cutoff.setDate(cutoff.getDate() - (LITE_HISTORY_DAYS - 1));
  return cutoff;
};

export type LockedFeatureCopy = {
  title: string;
  subtitle: string;
  bullets: string[];
  /** Tier, das das Feature freischaltet – steuert die CTA-Beschriftung. */
  requiredTier: "standard" | "premium";
};

export const LOCKED_FEATURE_COPY: Record<AppFeature, LockedFeatureCopy> = {
  basisTracker: {
    title: "Basis-Tracker",
    subtitle: "In jedem Lotti-Abo enthalten.",
    bullets: [],
    requiredTier: "standard",
  },
  partnerLink: {
    title: "Gemeinsam als Familie",
    subtitle:
      "Verknüpfe dein Konto mit deinem Partner – beide sehen und tracken dasselbe Baby.",
    bullets: [
      "Einträge landen sofort bei euch beiden",
      "Wer übernimmt die Nacht? Ihr seht beide den Stand",
      "Benachrichtigungen für den Partner",
    ],
    requiredTier: "standard",
  },
  planner: {
    title: "Planer & Termine",
    subtitle:
      "Behaltet Arzttermine, U-Untersuchungen und euren Alltag im Blick.",
    bullets: [
      "Gemeinsamer Familienkalender",
      "Erinnerungen an wichtige Termine",
      "Synchron mit deinem Partner",
    ],
    requiredTier: "standard",
  },
  shoppingList: {
    title: "Einkauf",
    subtitle: "Einkaufslisten und Kundenkarten an einem Ort.",
    bullets: [
      "Geteilte Listen für euch beide",
      "Kundenkarten schnell griffbereit",
      "Gemeinsame Aktualisierung in Echtzeit",
    ],
    requiredTier: "standard",
  },
  wochenmomente: {
    title: "Wochenmomente",
    subtitle: "Sammle jede Woche einen besonderen Moment eures Babys.",
    bullets: [
      "Wöchentliche Erinnerungs-Sammlung",
      "Eure Geschichte zum Zurückblättern",
      "Momente mit dem Partner teilen",
    ],
    requiredTier: "standard",
  },
  pdfExport: {
    title: "Auswertungen & PDF-Export",
    subtitle: "Alle Daten übersichtlich – auch für den Kinderarzt.",
    bullets: [
      "PDF-Berichte für U-Untersuchungen",
      "Schlaf- und Fütter-Auswertungen",
      "Daten gehören euch – jederzeit exportierbar",
    ],
    requiredTier: "standard",
  },
  recipes: {
    title: "Rezepte & Beikost",
    subtitle: "Rezeptideen und Beikost-Begleitung für euer Baby.",
    bullets: [
      "Altersgerechte Rezeptideen",
      "Eigene Rezepte speichern",
      "Beikost-Videokurs",
    ],
    requiredTier: "standard",
  },
  fullHistory: {
    title: "Kompletter Verlauf",
    subtitle:
      "In Lotti Lite siehst du die letzten 7 Tage – mit einem Abo bleibt eure ganze Geschichte erreichbar.",
    bullets: [
      "Alle Einträge seit dem ersten Tag",
      "Entwicklungen über Wochen und Monate verfolgen",
      "Nichts geht verloren – deine Daten bleiben gespeichert",
    ],
    requiredTier: "standard",
  },
  sleepMonthView: {
    title: "Monatsansicht im Schlaftracker",
    subtitle:
      "Mit der Monatsansicht erkennst du Schlafmuster und Entwicklungen auf einen Blick.",
    bullets: [
      "Schlafkalender für den ganzen Monat",
      "Durchschnitt und längste Schlafphase vergleichen",
      "Entwicklungen über mehrere Wochen erkennen",
    ],
    requiredTier: "standard",
  },
  dailyMonthView: {
    title: "Monatsansicht in Unser Tag",
    subtitle:
      "Mit dem Aktivitätskalender erkennst du Fütter- und Wickelmuster über den ganzen Monat.",
    bullets: [
      "Aktivitätskalender für den ganzen Monat",
      "Mahlzeiten und Wickeleinträge zusammenfassen",
      "Entwicklungen über mehrere Wochen erkennen",
    ],
    requiredTier: "standard",
  },
  voiceLog: {
    title: "Sprach-Logging",
    subtitle:
      "Einfach einsprechen – Lotti trägt Stillen, Schlafen & Wickeln für dich ein.",
    bullets: [
      "Nachts mit einer Hand bedienbar",
      "Lotti versteht dich und ordnet alles richtig zu",
      "Ein KI-Feature aus Lotti Premium",
    ],
    requiredTier: "premium",
  },
  fuersorge: {
    title: "Lottis Fürsorge",
    subtitle:
      "Tägliche, persönliche Hinweise für euch – aus Wetter, Alter und euren Daten.",
    bullets: [
      "UV-, Regen- und Temperatur-Hinweise für euer Baby",
      "Persönliche Impulse statt generischer Tipps",
      "Ein KI-Feature aus Lotti Premium",
    ],
    requiredTier: "premium",
  },
  fragLotti: {
    title: "Frag Lotti",
    subtitle:
      "Stelle Fragen rund um euren Babyalltag und erhalte allgemeine Orientierung, ergänzt durch passende Lotti-Daten.",
    bullets: [
      "Alltagsfragen zu Schlaf, Fütterung, Größen und Routinen stellen",
      "Passende Einträge werden automatisch und sichtbar einbezogen",
      "Keine Diagnosen und keine erfundenen Ursachen",
    ],
    requiredTier: "premium",
  },
  pregnancyBriefing: {
    title: "Persönliches Schwangerschafts-Briefing",
    subtitle:
      "Dein täglicher Überblick passend zu deiner SSW, deinen Einträgen und euren nächsten Schritten.",
    bullets: [
      "Selfcare passend zu deinem letzten Check-in",
      "Termine und offene Arztfragen auf einen Blick",
      "Eine Partner-Aufgabe und die nächste Vorbereitung",
    ],
    requiredTier: "premium",
  },
};

/**
 * Tier-Auflösung:
 *   1. Mock-Override (Entwicklung, solange RevenueCat nicht verknüpft ist)
 *   2. Admins & Premiumtester → premium (wie bisher bei den KI-Features)
 *   3. Lite-Tester → lite (Sonderzugang, erlebt bewusst die Lite-Grenzen)
 *   4. Tester/Kooperationspartner → standard (Sonderzugang wie bisher: alles
 *      außer KI — KI war schon vorher Premiumtester-only)
 *   5. Aktives Abo → Tier aus der Produkt-ID
 *   6. Kein Abo (Trial) → standard: die Testphase zeigt die volle App ohne
 *      KI, damit das KI-Budget hinter dem Premium-Abo bleibt
 */
export const resolveSubscriptionTier =
  async (): Promise<AppSubscriptionTier> => {
    const state = await refreshCurrentSubscriptionAccess({ force: true });
    return state.tier;
  };

/**
 * Markiert den Stand nur als veraltet. Der last-known-good Cache bleibt
 * erhalten und wird nicht aufgrund eines Timeouts oder Netzfehlers gelöscht.
 */
export const invalidateSubscriptionTierCache = () => {
  markSubscriptionAccessStale();
  void refreshCurrentSubscriptionAccess({ force: true }).catch((error) => {
    console.warn("Subscription access refresh unavailable:", error);
  });
};

export const getSubscriptionTier = async (): Promise<AppSubscriptionTier> =>
  (await getSubscriptionAccessState()).tier;

export const hasFeatureAccess = async (
  feature: AppFeature,
): Promise<boolean> => {
  const state = await getSubscriptionAccessState();
  return featureAllowedByPolicy(state.policy, feature, state.tier);
};

export const featureAllowedForTier = (
  feature: AppFeature,
  tier: AppSubscriptionTier,
): boolean =>
  featureAllowedByPolicy(getCurrentSubscriptionFeaturePolicy(), feature, tier);

export type FeatureAccessState = {
  /** null = wird noch geprüft */
  hasAccess: boolean | null;
  tier: AppSubscriptionTier | null;
};

/** Liefert synchron den lokalen Stand; Aktualisierungen laufen zentral. */
export const useFeatureAccess = (feature: AppFeature): FeatureAccessState => {
  const access = useSubscriptionAccess();
  return {
    hasAccess: featureAllowedByPolicy(access.policy, feature, access.tier),
    tier: access.tier,
  };
};

export const useSubscriptionTier = (): AppSubscriptionTier | null => {
  const access = useSubscriptionAccess();
  return access.tier;
};
