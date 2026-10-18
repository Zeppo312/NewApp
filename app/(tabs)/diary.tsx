import { useEffect } from 'react';
import { useRouter } from 'expo-router';
import { useBabyStatus } from '@/contexts/BabyStatusContext';

export default function DiaryRedirectScreen() {
  const router = useRouter();
  const { isBabyBorn, isLoading, isResolved } = useBabyStatus();

  useEffect(() => {
    if (isLoading || !isResolved) return;
    router.replace(isBabyBorn ? '/(tabs)/home' : '/(tabs)/pregnancy-home');
  }, [isBabyBorn, isLoading, isResolved, router]);

  return null;
}
