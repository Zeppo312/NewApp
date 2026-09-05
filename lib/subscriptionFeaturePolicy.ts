import AsyncStorage from "@react-native-async-storage/async-storage";

import { supabase } from "@/lib/supabase";

export const SUBSCRIPTION_TIERS = ["lite", "standard", "premium"] as const;
export type AppSubscriptionTier = (typeof SUBSCRIPTION_TIERS)[number];

export const APP_FEATURES = [
  "basisTracker",
  "partnerLink",
  "planner",
  "shoppingList",
  "wochenmomente",
  "pdfExport",
  "recipes",
  "fullHistory",
  "sleepMonthView",
  "dailyMonthView",
  "voiceLog",
  "fuersorge",
  "fragLotti",
  "pregnancyBriefing",
] as const;
export type AppFeature = (typeof APP_FEATURES)[number];

export type SubscriptionFeatureMatrix = Record<
  AppFeature,
  AppSubscriptionTier[]
>;

export type SubscriptionFeaturePolicy = {
  schemaVersion: 1;
  policyVersion: number;
  updatedAt: string | null;
  features: SubscriptionFeatureMatrix;
};

export const DEFAULT_FEATURE_MATRIX: SubscriptionFeatureMatrix = {
  basisTracker: ["lite", "standard", "premium"],
  partnerLink: ["standard", "premium"],
  planner: ["standard", "premium"],
  shoppingList: ["standard", "premium"],
  wochenmomente: ["standard", "premium"],
  pdfExport: ["standard", "premium"],
  recipes: ["standard", "premium"],
  fullHistory: ["standard", "premium"],
  sleepMonthView: ["standard", "premium"],
  dailyMonthView: ["standard", "premium"],
  voiceLog: ["premium"],
  fuersorge: ["premium"],
  fragLotti: ["premium"],
  pregnancyBriefing: ["premium"],
};

export const DEFAULT_SUBSCRIPTION_FEATURE_POLICY: SubscriptionFeaturePolicy = {
  schemaVersion: 1,
  policyVersion: 1,
  updatedAt: null,
  features: DEFAULT_FEATURE_MATRIX,
};

export const FEATURE_ADMIN_COPY: Record<
  AppFeature,
  {
    label: string;
    description: string;
    icon: string;
    section: "baby" | "ai" | "pregnancy";
    areas: readonly string[];
    serverEnforced: boolean;
    editable: boolean;
  }
> = {
  basisTracker: {
    label: "Basis-Tracker",
    description: "Stillen, Schlafen, Flasche, Wickeln und Tagesübersicht",
    icon: "🍼",
    section: "baby",
    areas: ["Home", "Schlaf", "Füttern & Wickeln"],
    serverEnforced: false,
    // Der Kern der App bleibt in jedem Tarif verfügbar. Die Zuordnung wird
    // angezeigt, aber nicht versehentlich im Admin-Screen abschaltbar gemacht.
    editable: false,
  },
  partnerLink: {
    label: "Partner-Verknüpfung",
    description: "Gemeinsam dasselbe Baby verwalten und tracken",
    icon: "👥",
    section: "baby",
    areas: ["Konto verknüpfen", "Gemeinsame Baby-Daten"],
    serverEnforced: false,
    editable: true,
  },
  planner: {
    label: "Planer",
    description: "Termine, Erinnerungen und gemeinsamer Kalender",
    icon: "🗓️",
    section: "baby",
    areas: ["Planer", "Termine & Erinnerungen"],
    serverEnforced: false,
    editable: true,
  },
  shoppingList: {
    label: "Einkauf",
    description: "Einkaufslisten und Kundenkarten",
    icon: "🛒",
    section: "baby",
    areas: ["Einkaufsliste", "Kundenkarten"],
    serverEnforced: false,
    editable: true,
  },
  wochenmomente: {
    label: "Wochenmomente",
    description: "Wöchentliche Erinnerungen und Sammlung",
    icon: "📸",
    section: "baby",
    areas: ["Wochenmoment", "Wochenkarte"],
    serverEnforced: false,
    editable: true,
  },
  pdfExport: {
    label: "PDF-Export",
    description: "Auswertungen, Berichte und Datenexport",
    icon: "📄",
    section: "baby",
    areas: ["App-Einstellungen", "PDF-Berichte"],
    serverEnforced: false,
    editable: true,
  },
  recipes: {
    label: "Rezepte",
    description: "Rezepte, Generator und Beikost-Inhalte",
    icon: "🥣",
    section: "baby",
    areas: ["Rezepte", "Meine Rezepte", "Beikost-Auswahl", "Beikost-Videokurs"],
    serverEnforced: false,
    editable: true,
  },
  fullHistory: {
    label: "Kompletter Verlauf",
    description: "Zugriff über die letzten sieben Tage hinaus",
    icon: "📈",
    section: "baby",
    areas: ["Schlafverlauf", "Tag, Woche & Monat"],
    serverEnforced: false,
    editable: true,
  },
  sleepMonthView: {
    label: "Schlaftracker: Monatsansicht",
    description: "Monatliche Schlafauswertung und Kalenderansicht",
    icon: "📅",
    section: "baby",
    areas: ["Schlaftracker", "Monatsansicht"],
    serverEnforced: false,
    editable: true,
  },
  dailyMonthView: {
    label: "Unser Tag: Monatsansicht",
    description: "Monatlicher Aktivitätskalender für Füttern und Wickeln",
    icon: "🗓️",
    section: "baby",
    areas: ["Unser Tag", "Monatsansicht"],
    serverEnforced: false,
    editable: true,
  },
  voiceLog: {
    label: "Sprach-Logging",
    description: "Einträge per Spracheingabe erfassen",
    icon: "🎙️",
    section: "ai",
    areas: ["Home", "Sprachdialog"],
    serverEnforced: true,
    editable: true,
  },
  fuersorge: {
    label: "Lottis Fürsorge",
    description: "Persönliche tägliche Hinweise",
    icon: "🌿",
    section: "ai",
    areas: ["Home", "Lottis Fürsorge"],
    serverEnforced: true,
    editable: true,
  },
  fragLotti: {
    label: "Frag Lotti",
    description: "KI-Antworten mit passenden Lotti-Daten",
    icon: "✨",
    section: "ai",
    areas: ["Home", "Frag Lotti"],
    serverEnforced: true,
    editable: true,
  },
  pregnancyBriefing: {
    label: "Schwangerschafts-Briefing",
    description: "Persönlicher täglicher Schwangerschaftsüberblick",
    icon: "🤰",
    section: "pregnancy",
    areas: ["Schwangerschaft-Home", "Tägliches Briefing"],
    serverEnforced: false,
    editable: true,
  },
};

const CACHE_KEY = "subscription_feature_policy_v1";
export const FEATURE_POLICY_REFRESH_MS = 24 * 60 * 60 * 1000;

type StoredPolicy = {
  policy: SubscriptionFeaturePolicy;
  fetchedAt: number;
};

let currentPolicy = clonePolicy(DEFAULT_SUBSCRIPTION_FEATURE_POLICY);
let fetchedAt = 0;
let hydrated = false;
let hydratePromise: Promise<SubscriptionFeaturePolicy> | null = null;
let refreshPromise: Promise<SubscriptionFeaturePolicy> | null = null;
const listeners = new Set<(policy: SubscriptionFeaturePolicy) => void>();

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

export const isAppFeature = (value: unknown): value is AppFeature =>
  typeof value === "string" &&
  (APP_FEATURES as readonly string[]).includes(value);

export const isSubscriptionTier = (
  value: unknown,
): value is AppSubscriptionTier =>
  typeof value === "string" &&
  (SUBSCRIPTION_TIERS as readonly string[]).includes(value);

export function cloneFeatureMatrix(
  matrix: SubscriptionFeatureMatrix,
): SubscriptionFeatureMatrix {
  return Object.fromEntries(
    APP_FEATURES.map((feature) => [feature, [...matrix[feature]]]),
  ) as SubscriptionFeatureMatrix;
}

export function clonePolicy(
  policy: SubscriptionFeaturePolicy,
): SubscriptionFeaturePolicy {
  return {
    ...policy,
    features: cloneFeatureMatrix(policy.features),
  };
}

export function sanitizeSubscriptionFeaturePolicy(
  value: unknown,
): SubscriptionFeaturePolicy | null {
  if (!isRecord(value)) return null;

  const rawFeatures = value.features;
  if (!isRecord(rawFeatures)) return null;
  if (
    Object.keys(rawFeatures).length !== APP_FEATURES.length ||
    Object.keys(rawFeatures).some((feature) => !isAppFeature(feature))
  ) {
    return null;
  }

  const policyVersion = Number(value.policyVersion ?? value.policy_version);
  if (!Number.isSafeInteger(policyVersion) || policyVersion < 1) return null;

  const features = {} as SubscriptionFeatureMatrix;
  for (const feature of APP_FEATURES) {
    const rawTiers = rawFeatures[feature];
    if (!Array.isArray(rawTiers)) return null;

    const tiers = SUBSCRIPTION_TIERS.filter((tier) => rawTiers.includes(tier));
    if (tiers.length !== rawTiers.length) return null;
    features[feature] = [...tiers];
  }

  return {
    schemaVersion: 1,
    policyVersion,
    updatedAt:
      typeof value.updatedAt === "string"
        ? value.updatedAt
        : typeof value.updated_at === "string"
          ? value.updated_at
          : null,
    features,
  };
}

const publishLocalPolicy = (
  policy: SubscriptionFeaturePolicy,
  nextFetchedAt: number,
) => {
  currentPolicy = clonePolicy(policy);
  fetchedAt = nextFetchedAt;
  listeners.forEach((listener) => listener(clonePolicy(currentPolicy)));
};

const persistPolicy = async (
  policy: SubscriptionFeaturePolicy,
  nextFetchedAt: number,
) => {
  const stored: StoredPolicy = {
    policy: clonePolicy(policy),
    fetchedAt: nextFetchedAt,
  };
  await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(stored));
};

export const hydrateSubscriptionFeaturePolicy = async () => {
  if (hydrated) return clonePolicy(currentPolicy);
  if (hydratePromise) return hydratePromise;

  hydratePromise = (async () => {
    try {
      const raw = await AsyncStorage.getItem(CACHE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Partial<StoredPolicy>;
        const policy = sanitizeSubscriptionFeaturePolicy(parsed.policy);
        if (policy && typeof parsed.fetchedAt === "number") {
          const safeFetchedAt =
            Number.isFinite(parsed.fetchedAt) &&
            parsed.fetchedAt >= 0 &&
            parsed.fetchedAt <= Date.now() + 5 * 60_000
              ? parsed.fetchedAt
              : 0;
          publishLocalPolicy(policy, safeFetchedAt);
        }
      }
    } catch (error) {
      console.warn(
        "Subscription feature policy cache could not be read:",
        error,
      );
    } finally {
      hydrated = true;
    }

    return clonePolicy(currentPolicy);
  })().finally(() => {
    hydratePromise = null;
  });

  return hydratePromise;
};

export const isSubscriptionFeaturePolicyStale = (now = Date.now()) =>
  fetchedAt <= 0 || now - fetchedAt >= FEATURE_POLICY_REFRESH_MS;

export const fetchSubscriptionFeaturePolicy = async () => {
  const { data, error } = await supabase.rpc("get_subscription_feature_policy");
  if (error) throw error;

  const policy = sanitizeSubscriptionFeaturePolicy(data);
  if (!policy) {
    throw new Error("Ungültige Abo-Feature-Konfiguration vom Server.");
  }
  return policy;
};

export const refreshSubscriptionFeaturePolicy = async (
  options: { force?: boolean } = {},
) => {
  await hydrateSubscriptionFeaturePolicy();
  if (!options.force && !isSubscriptionFeaturePolicyStale()) {
    return clonePolicy(currentPolicy);
  }
  if (refreshPromise) return refreshPromise;

  refreshPromise = (async () => {
    const policy = await fetchSubscriptionFeaturePolicy();
    const now = Date.now();
    publishLocalPolicy(policy, now);
    try {
      await persistPolicy(policy, now);
    } catch (error) {
      console.warn(
        "Subscription feature policy cache could not be saved:",
        error,
      );
    }
    return clonePolicy(policy);
  })().finally(() => {
    refreshPromise = null;
  });

  return refreshPromise;
};

/**
 * Liefert immer sofort den letzten lokalen Stand. Eine nötige Netzabfrage
 * läuft bewusst im Hintergrund und kann diesen Aufruf nicht blockieren.
 */
export const getSubscriptionFeaturePolicy = async () => {
  const policy = await hydrateSubscriptionFeaturePolicy();
  if (isSubscriptionFeaturePolicyStale()) {
    void refreshSubscriptionFeaturePolicy().catch((error) => {
      console.warn("Subscription feature policy refresh unavailable:", error);
    });
  }
  return policy;
};

export const getCurrentSubscriptionFeaturePolicy = () =>
  clonePolicy(currentPolicy);

export const subscribeToSubscriptionFeaturePolicy = (
  listener: (policy: SubscriptionFeaturePolicy) => void,
) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const markSubscriptionFeaturePolicyStale = () => {
  fetchedAt = 0;
};

export const featureAllowedByPolicy = (
  policy: SubscriptionFeaturePolicy,
  feature: AppFeature,
  tier: AppSubscriptionTier,
) => policy.features[feature].includes(tier);

export const publishSubscriptionFeaturePolicy = async (
  expectedVersion: number,
  matrix: SubscriptionFeatureMatrix,
) => {
  const { data, error } = await supabase.rpc(
    "admin_publish_subscription_feature_policy",
    {
      p_expected_version: expectedVersion,
      p_matrix: cloneFeatureMatrix(matrix),
    },
  );
  if (error) throw error;

  const policy = sanitizeSubscriptionFeaturePolicy(data);
  if (!policy) {
    throw new Error("Die gespeicherte Abo-Konfiguration ist ungültig.");
  }

  const now = Date.now();
  publishLocalPolicy(policy, now);
  await persistPolicy(policy, now);
  return clonePolicy(policy);
};

export const resetSubscriptionFeaturePolicyForTests = () => {
  currentPolicy = clonePolicy(DEFAULT_SUBSCRIPTION_FEATURE_POLICY);
  fetchedAt = 0;
  hydrated = false;
  hydratePromise = null;
  refreshPromise = null;
  listeners.clear();
};
