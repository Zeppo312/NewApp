import AsyncStorage from '@react-native-async-storage/async-storage';

import { supabase } from '@/lib/supabase';
import {
  getCurrentSubscriptionFeaturePolicy,
  hydrateSubscriptionFeaturePolicy,
  isSubscriptionFeaturePolicyStale,
  refreshSubscriptionFeaturePolicy,
  subscribeToSubscriptionFeaturePolicy,
  type AppSubscriptionTier,
  type SubscriptionFeaturePolicy,
} from '@/lib/subscriptionFeaturePolicy';

export const SUBSCRIPTION_ACCESS_REFRESH_MS = 24 * 60 * 60 * 1000;
export const SUBSCRIPTION_ACCESS_FAILED_RETRY_MS = 60 * 60 * 1000;
const CACHE_PREFIX = 'subscription_access_v1';

export type SubscriptionAccessSource =
  | 'admin'
  | 'premium_tester'
  | 'lite_tester'
  | 'tester'
  | 'cooperation_partner'
  | 'subscription'
  | 'trial_fallback';

export type SubscriptionTierSnapshot = {
  schemaVersion: 1;
  userId: string;
  tier: AppSubscriptionTier;
  source: SubscriptionAccessSource;
  verifiedAt: number;
  subscriptionExpiresAt: string | null;
};

export type SubscriptionAccessState = {
  userId: string | null;
  tier: AppSubscriptionTier;
  source: SubscriptionAccessSource;
  subscriptionExpiresAt: string | null;
  verifiedAt: number;
  policy: SubscriptionFeaturePolicy;
  hydrated: boolean;
  refreshing: boolean;
};

type RefreshResult =
  | { status: 'verified'; snapshot: SubscriptionTierSnapshot }
  | { status: 'unavailable'; reason: string };

const defaultState = (): SubscriptionAccessState => ({
  userId: null,
  tier: 'standard',
  source: 'trial_fallback',
  subscriptionExpiresAt: null,
  verifiedAt: 0,
  policy: getCurrentSubscriptionFeaturePolicy(),
  hydrated: true,
  refreshing: false,
});

let currentState = defaultState();
let hydrationRevision = 0;
const listeners = new Set<(state: SubscriptionAccessState) => void>();
const refreshPromises = new Map<string, Promise<SubscriptionAccessState>>();
const failedRefreshAt = new Map<string, number>();

const cacheKey = (userId: string) => `${CACHE_PREFIX}:${userId}`;

const cloneState = (state: SubscriptionAccessState): SubscriptionAccessState => ({
  ...state,
  policy: {
    ...state.policy,
    features: Object.fromEntries(
      Object.entries(state.policy.features).map(([feature, tiers]) => [
        feature,
        [...tiers],
      ]),
    ) as SubscriptionFeaturePolicy['features'],
  },
});

const emit = (nextState: SubscriptionAccessState) => {
  currentState = cloneState(nextState);
  listeners.forEach((listener) => listener(cloneState(currentState)));
};

const isTier = (value: unknown): value is AppSubscriptionTier =>
  value === 'lite' || value === 'standard' || value === 'premium';

const isSource = (value: unknown): value is SubscriptionAccessSource =>
  value === 'admin' ||
  value === 'premium_tester' ||
  value === 'lite_tester' ||
  value === 'tester' ||
  value === 'cooperation_partner' ||
  value === 'subscription' ||
  value === 'trial_fallback';

export const sanitizeSubscriptionTierSnapshot = (
  value: unknown,
  expectedUserId: string,
): SubscriptionTierSnapshot | null => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const source = value as Record<string, unknown>;
  if (
    source.schemaVersion !== 1 ||
    source.userId !== expectedUserId ||
    !isTier(source.tier) ||
    !isSource(source.source) ||
    typeof source.verifiedAt !== 'number' ||
    !Number.isFinite(source.verifiedAt)
  ) {
    return null;
  }

  return {
    schemaVersion: 1,
    userId: expectedUserId,
    tier: source.tier,
    source: source.source,
    // Ein manipuliertes oder durch eine falsche Geräteuhr weit in die Zukunft
    // gesetztes Datum darf keine Aktualisierung dauerhaft unterdrücken. Der
    // gültige LKG-Tarif bleibt erhalten, wird aber sofort als veraltet markiert.
    verifiedAt:
      source.verifiedAt >= 0 && source.verifiedAt <= Date.now() + 5 * 60_000
        ? source.verifiedAt
        : 0,
    subscriptionExpiresAt:
      typeof source.subscriptionExpiresAt === 'string'
        ? source.subscriptionExpiresAt
        : null,
  };
};

const readSnapshot = async (userId: string) => {
  try {
    const raw = await AsyncStorage.getItem(cacheKey(userId));
    if (!raw) return null;
    return sanitizeSubscriptionTierSnapshot(JSON.parse(raw), userId);
  } catch (error) {
    console.warn('Subscription access cache could not be read:', error);
    return null;
  }
};

const persistSnapshot = async (snapshot: SubscriptionTierSnapshot) => {
  await AsyncStorage.setItem(cacheKey(snapshot.userId), JSON.stringify(snapshot));
};

const tierFromSpecialAccess = (
  profile: { is_admin?: boolean | null; paywall_access_role?: string | null } | null,
): { tier: AppSubscriptionTier; source: SubscriptionAccessSource } | null => {
  if (profile?.is_admin === true) return { tier: 'premium', source: 'admin' };
  if (profile?.paywall_access_role === 'premium_tester') {
    return { tier: 'premium', source: 'premium_tester' };
  }
  if (profile?.paywall_access_role === 'lite_tester') {
    return { tier: 'lite', source: 'lite_tester' };
  }
  if (profile?.paywall_access_role === 'tester') {
    return { tier: 'standard', source: 'tester' };
  }
  if (profile?.paywall_access_role === 'cooperation_partner') {
    return { tier: 'standard', source: 'cooperation_partner' };
  }
  return null;
};

const resolveVerifiedTier = async (
  userId: string,
  previous: SubscriptionTierSnapshot | null,
): Promise<RefreshResult> => {
  const mockTier = process.env.EXPO_PUBLIC_MOCK_SUBSCRIPTION_TIER;
  if (isTier(mockTier)) {
    return {
      status: 'verified',
      snapshot: {
        schemaVersion: 1,
        userId,
        tier: mockTier,
        source: 'trial_fallback',
        verifiedAt: Date.now(),
        subscriptionExpiresAt: null,
      },
    };
  }

  const profileResult = await supabase
    .from('profiles')
    .select('is_admin,paywall_access_role')
    .eq('id', userId)
    .maybeSingle();

  if (!profileResult.error) {
    const special = tierFromSpecialAccess(profileResult.data);
    if (special) {
      return {
        status: 'verified',
        snapshot: {
          schemaVersion: 1,
          userId,
          tier: special.tier,
          source: special.source,
          verifiedAt: Date.now(),
          subscriptionExpiresAt: null,
        },
      };
    }
  }

  // RevenueCat ist ein großes natives Modul. Es wird erst für die tatsächliche
  // Hintergrundprüfung geladen und bleibt aus dem kritischen Startpfad heraus.
  const {
    getRevenueCatSubscriptionSummary,
    getTierFromProductId,
  } = await import('@/lib/revenuecat');
  const summary = await getRevenueCatSubscriptionSummary(userId);
  if (summary.availability === 'unavailable') {
    return { status: 'unavailable', reason: 'revenuecat_unavailable' };
  }

  if (summary.isActive) {
    const tier = summary.tier ?? getTierFromProductId(summary.productId);
    return {
      status: 'verified',
      snapshot: {
        schemaVersion: 1,
        userId,
        tier: tier ?? 'standard',
        source: 'subscription',
        verifiedAt: Date.now(),
        subscriptionExpiresAt: summary.expiresDate,
      },
    };
  }

  // Ein Profilfehler darf einen vorher bestätigten Admin-/Testerzugang nicht
  // als normales Trial interpretieren und dadurch herabstufen.
  if (
    profileResult.error &&
    previous &&
    previous.source !== 'subscription' &&
    previous.source !== 'trial_fallback'
  ) {
    return { status: 'unavailable', reason: 'profile_unavailable' };
  }

  if (profileResult.error) {
    return { status: 'unavailable', reason: 'profile_unavailable' };
  }

  return {
    status: 'verified',
    snapshot: {
      schemaVersion: 1,
      userId,
      tier: 'standard',
      source: 'trial_fallback',
      verifiedAt: Date.now(),
      subscriptionExpiresAt: null,
    },
  };
};

export const getCurrentSubscriptionAccessState = () => cloneState(currentState);

/**
 * Imperativer Zugriff für Services außerhalb von React. getSession liest die
 * lokal persistierte Supabase-Session und verursacht keine zusätzliche
 * Netzwerkprüfung.
 */
export const getSubscriptionAccessState = async () => {
  const currentUserId = currentState.userId;
  if (currentUserId && currentState.hydrated) {
    if (isSubscriptionAccessStale() || isSubscriptionFeaturePolicyStale()) {
      void refreshSubscriptionAccess(currentUserId).catch((error) => {
        console.warn('Subscription access background refresh unavailable:', error);
      });
    }
    return getCurrentSubscriptionAccessState();
  }

  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? null;
  return hydrateSubscriptionAccess(userId);
};

export const refreshCurrentSubscriptionAccess = async (
  options: { force?: boolean } = {},
) => {
  const { data } = await supabase.auth.getSession();
  const userId = data.session?.user?.id ?? currentState.userId;
  if (!userId) return getCurrentSubscriptionAccessState();
  return refreshSubscriptionAccess(userId, options);
};

export const subscribeToSubscriptionAccess = (
  listener: (state: SubscriptionAccessState) => void,
) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

export const isSubscriptionAccessStale = (
  state = currentState,
  now = Date.now(),
) => state.verifiedAt <= 0 || now - state.verifiedAt >= SUBSCRIPTION_ACCESS_REFRESH_MS;

export const hydrateSubscriptionAccess = async (userId: string | null) => {
  const revision = ++hydrationRevision;
  if (!userId) {
    emit(defaultState());
    return getCurrentSubscriptionAccessState();
  }

  if (currentState.userId !== userId) {
    emit({
      ...defaultState(),
      userId,
      hydrated: false,
    });
  }

  const [snapshot, policy] = await Promise.all([
    readSnapshot(userId),
    hydrateSubscriptionFeaturePolicy(),
  ]);
  if (revision !== hydrationRevision || currentState.userId !== userId) {
    return getCurrentSubscriptionAccessState();
  }

  emit({
    userId,
    tier: snapshot?.tier ?? 'standard',
    source: snapshot?.source ?? 'trial_fallback',
    subscriptionExpiresAt: snapshot?.subscriptionExpiresAt ?? null,
    verifiedAt: snapshot?.verifiedAt ?? 0,
    policy,
    hydrated: true,
    refreshing: false,
  });

  if (
    isSubscriptionAccessStale() ||
    isSubscriptionFeaturePolicyStale()
  ) {
    void refreshSubscriptionAccess(userId).catch((error) => {
      console.warn('Subscription access background refresh unavailable:', error);
    });
  }

  return getCurrentSubscriptionAccessState();
};

export const refreshSubscriptionAccess = async (
  userId: string,
  options: { force?: boolean } = {},
) => {
  const existing = refreshPromises.get(userId);
  if (existing) return existing;

  const now = Date.now();
  if (
    !options.force &&
    !isSubscriptionAccessStale() &&
    !isSubscriptionFeaturePolicyStale()
  ) {
    return getCurrentSubscriptionAccessState();
  }
  if (
    !options.force &&
    now - (failedRefreshAt.get(userId) ?? 0) <
      SUBSCRIPTION_ACCESS_FAILED_RETRY_MS
  ) {
    // Der RevenueCat-Retry wird gedrosselt, eine veraltete Feature-Matrix aber
    // unabhängig davon im Hintergrund aktualisiert.
    if (isSubscriptionFeaturePolicyStale()) {
      void refreshSubscriptionFeaturePolicy().catch((error) => {
        console.warn('Subscription feature policy retry unavailable:', error);
      });
    }
    return getCurrentSubscriptionAccessState();
  }

  const promise = (async () => {
    if (currentState.userId === userId) {
      emit({ ...currentState, refreshing: true });
    }

    const previous = await readSnapshot(userId);
    const [tierResult, policyResult] = await Promise.allSettled([
      resolveVerifiedTier(userId, previous),
      refreshSubscriptionFeaturePolicy({ force: options.force }),
    ]);

    if (tierResult.status === 'fulfilled' && tierResult.value.status === 'verified') {
      try {
        await persistSnapshot(tierResult.value.snapshot);
      } catch (error) {
        console.warn('Subscription access cache could not be saved:', error);
      }
      failedRefreshAt.delete(userId);

      if (currentState.userId === userId) {
        emit({
          userId,
          tier: tierResult.value.snapshot.tier,
          source: tierResult.value.snapshot.source,
          subscriptionExpiresAt:
            tierResult.value.snapshot.subscriptionExpiresAt,
          verifiedAt: tierResult.value.snapshot.verifiedAt,
          policy: getCurrentSubscriptionFeaturePolicy(),
          hydrated: true,
          refreshing: false,
        });
      }
    } else {
      failedRefreshAt.set(userId, Date.now());
      if (currentState.userId === userId) {
        emit({
          ...currentState,
          policy: getCurrentSubscriptionFeaturePolicy(),
          refreshing: false,
        });
      }
    }

    if (policyResult.status === 'rejected') {
      console.warn(
        'Subscription feature policy refresh unavailable:',
        policyResult.reason,
      );
    }

    return getCurrentSubscriptionAccessState();
  })().finally(() => {
    refreshPromises.delete(userId);
  });

  refreshPromises.set(userId, promise);
  return promise;
};

export const markSubscriptionAccessStale = () => {
  if (currentState.userId) {
    emit({ ...currentState, verifiedAt: 0 });
  }
};

export const clearSubscriptionAccessCache = async (userId: string) => {
  await AsyncStorage.removeItem(cacheKey(userId));
  failedRefreshAt.delete(userId);
  refreshPromises.delete(userId);
  if (currentState.userId === userId) emit(defaultState());
};

subscribeToSubscriptionFeaturePolicy((policy) => {
  emit({ ...currentState, policy });
});

export const resetSubscriptionAccessForTests = () => {
  hydrationRevision += 1;
  currentState = defaultState();
  listeners.clear();
  refreshPromises.clear();
  failedRefreshAt.clear();
};
