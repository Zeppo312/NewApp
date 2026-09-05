import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';

import { getOnboardingCompletionState } from '@/lib/onboarding';
import {
  getActiveBabyResolutionScope,
  isResolutionCurrent,
} from '@/lib/startupResolution';
import { useAuth } from './AuthContext';

type OnboardingStatusContextType = {
  isComplete: boolean;
  isResolved: boolean;
  refresh: () => Promise<boolean>;
};

type ResolvedOnboardingStatus = {
  scope: string | null;
  isComplete: boolean;
};

const OnboardingStatusContext = createContext<OnboardingStatusContextType | undefined>(
  undefined,
);

export function OnboardingStatusProvider({ children }: { children: React.ReactNode }) {
  const { loading: authLoading, user } = useAuth();
  const [resolved, setResolved] = useState<ResolvedOnboardingStatus>({
    scope: null,
    isComplete: false,
  });
  const latestRequestIdRef = useRef(0);
  const currentScope = getActiveBabyResolutionScope(user?.id);
  const isResolved =
    !authLoading && isResolutionCurrent(resolved.scope, currentScope);

  const refresh = useCallback(async () => {
    const requestId = ++latestRequestIdRef.current;
    const requestedUserId = user?.id ?? null;
    const requestedScope = getActiveBabyResolutionScope(requestedUserId);

    if (!requestedUserId) {
      setResolved({ scope: requestedScope, isComplete: false });
      return false;
    }

    try {
      const isComplete = await getOnboardingCompletionState(requestedUserId);
      if (requestId === latestRequestIdRef.current) {
        setResolved({ scope: requestedScope, isComplete });
      }
      return isComplete;
    } catch (error) {
      console.error('Failed to resolve onboarding status:', error);
      if (requestId === latestRequestIdRef.current) {
        setResolved({ scope: requestedScope, isComplete: false });
      }
      return false;
    }
  }, [user?.id]);

  useEffect(() => {
    if (authLoading) return;
    void refresh();
  }, [authLoading, refresh]);

  return (
    <OnboardingStatusContext.Provider
      value={{
        isComplete: isResolved && resolved.isComplete,
        isResolved,
        refresh,
      }}
    >
      {children}
    </OnboardingStatusContext.Provider>
  );
}

export function useOnboardingStatus() {
  const context = useContext(OnboardingStatusContext);
  if (!context) {
    throw new Error('useOnboardingStatus must be used within an OnboardingStatusProvider');
  }
  return context;
}
