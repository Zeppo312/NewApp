import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  getCurrentSubscriptionAccessState,
  hydrateSubscriptionAccess,
  isSubscriptionAccessStale,
  refreshSubscriptionAccess,
  subscribeToSubscriptionAccess,
  type SubscriptionAccessState,
} from '@/lib/subscriptionAccess';
import { isSubscriptionFeaturePolicyStale } from '@/lib/subscriptionFeaturePolicy';

type SubscriptionAccessContextValue = SubscriptionAccessState & {
  refresh: (options?: { force?: boolean }) => Promise<void>;
};

const SubscriptionAccessContext = createContext<SubscriptionAccessContextValue | null>(
  null,
);

export function SubscriptionAccessProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [state, setState] = useState(getCurrentSubscriptionAccessState);

  useEffect(() => subscribeToSubscriptionAccess(setState), []);

  useEffect(() => {
    // Nur der lokale Cache wird abgewartet. Die Netzaktualisierung wird vom
    // Service anschließend fire-and-forget im Hintergrund angestoßen.
    void hydrateSubscriptionAccess(userId);
  }, [userId]);

  const refresh = useCallback(
    async (options: { force?: boolean } = {}) => {
      if (!userId) return;
      await refreshSubscriptionAccess(userId, options);
    },
    [userId],
  );

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextState) => {
      if (
        nextState === 'active' &&
        userId &&
        (isSubscriptionAccessStale() || isSubscriptionFeaturePolicyStale())
      ) {
        void refreshSubscriptionAccess(userId).catch((error) => {
          console.warn('Subscription refresh on foreground unavailable:', error);
        });
      }
    });
    return () => subscription.remove();
  }, [userId]);

  return (
    <SubscriptionAccessContext.Provider value={{ ...state, refresh }}>
      {children}
    </SubscriptionAccessContext.Provider>
  );
}

export const useSubscriptionAccess = (): SubscriptionAccessContextValue => {
  const context = useContext(SubscriptionAccessContext);
  if (context) return context;

  return {
    ...getCurrentSubscriptionAccessState(),
    refresh: async () => undefined,
  };
};
