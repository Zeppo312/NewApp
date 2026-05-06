import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useEffect, useState } from 'react';
import { getOnboardingCompletionState } from '@/lib/onboarding';

export default function AuthIndex() {
  const { session, loading: authLoading } = useAuth();
  const { isBabyBorn, isLoading: babyStatusLoading, isResolved: babyStatusResolved } = useBabyStatus();
  const [isCheckingOnboarding, setIsCheckingOnboarding] = useState(false);
  const [isOnboardingComplete, setIsOnboardingComplete] = useState(false);

  useEffect(() => {
    if (authLoading || !session?.user || !babyStatusResolved) {
      setIsCheckingOnboarding(false);
      setIsOnboardingComplete(false);
      return;
    }

    let cancelled = false;
    setIsCheckingOnboarding(true);

    getOnboardingCompletionState()
      .then((complete) => {
        if (!cancelled) {
          setIsOnboardingComplete(complete);
        }
      })
      .catch((error) => {
        console.error('Failed to check onboarding completion on auth index:', error);
        if (!cancelled) {
          setIsOnboardingComplete(false);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsCheckingOnboarding(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, babyStatusResolved, session?.user]);

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
