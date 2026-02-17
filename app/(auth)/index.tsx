import { Redirect } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useAuth } from '@/contexts/AuthContext';
import { useBabyStatus } from '@/contexts/BabyStatusContext';

export default function AuthIndex() {
  const { session, loading: authLoading } = useAuth();
  const { isBabyBorn, isLoading: babyStatusLoading } = useBabyStatus();

  if (authLoading || babyStatusLoading) {
    return (
      <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#FFFFFF' }}>
        <ActivityIndicator size="large" color="#E9C9B6" />
      </View>
    );
  }

  if (session) {
    return <Redirect href={isBabyBorn ? '/(tabs)/home' : '/(tabs)/pregnancy-home'} />;
  }

  return <Redirect href="/(auth)/login" />;
}
