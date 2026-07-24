import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useEffect, useState } from 'react';
import { getOnboardingCompletionState } from '@/lib/onboarding';

export default function AuthIndex() {
  const { session, loading: authLoading } = useAuth();
  const { isBabyBorn, isLoading: babyStatusLoading, isResolved: babyStatusResolved } = useBabyStatus();
  const userId = session?.user?.id ?? null;
  const canCheckOnboarding = !authLoading && babyStatusResolved && userId !== null;
  const [onboardingResult, setOnboardingResult] = useState<{
    userId: string | null;
    complete: boolean;
  }>({ userId: null, complete: false });
  const isCheckingOnboarding = canCheckOnboarding && onboardingResult.userId !== userId;
  const isOnboardingComplete = canCheckOnboarding
    && onboardingResult.userId === userId
    && onboardingResult.complete;

  useEffect(() => {
    if (!canCheckOnboarding || !userId) {
      return;
    }

    let cancelled = false;

    getOnboardingCompletionState()
      .then((complete) => {
        if (!cancelled) {
          setOnboardingResult({ userId, complete });
        }
      })
      .catch((error) => {
        console.error('Failed to check onboarding completion on auth index:', error);
        if (!cancelled) {
          setOnboardingResult({ userId, complete: false });
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canCheckOnboarding, userId]);

  if (authLoading || babyStatusLoading || !babyStatusResolved || isCheckingOnboarding) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#E9C9B6" />
      </View>
    );
  }

  if (session) {
    if (!isOnboardingComplete) {
      return <Redirect href="/(auth)/getUserInfo" />;
    }

    return <Redirect href={isBabyBorn ? '/(tabs)/home' : '/(tabs)/pregnancy-home'} />;
  }

  return <Redirect href="/(auth)/login" />;
}
