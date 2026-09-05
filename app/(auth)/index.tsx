import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';
import { useOnboardingStatus } from '@/contexts/OnboardingStatusContext';

export default function AuthIndex() {
  const { session, loading: authLoading } = useAuth();
  const { isBabyBorn, isLoading: babyStatusLoading, isResolved: babyStatusResolved } = useBabyStatus();
  const {
    isComplete: isOnboardingComplete,
    isResolved: isOnboardingStatusResolved,
  } = useOnboardingStatus();

  if (
    authLoading ||
    babyStatusLoading ||
    !babyStatusResolved ||
    !isOnboardingStatusResolved
  ) {
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
