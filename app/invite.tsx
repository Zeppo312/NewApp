/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import { useEffect, useMemo } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Stack, router, useLocalSearchParams } from 'expo-router';

import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_AUTH_LOCALE,
  translateAuthText,
} from '@/lib/authTranslations';

let ACTIVE_AUTH_LOCALE = DEFAULT_AUTH_LOCALE;

export default function InviteRedirectScreen() {
  ACTIVE_AUTH_LOCALE = useLocale().locale;
  const { user, loading } = useAuth();
  const params = useLocalSearchParams<{ code?: string }>();

  const invitationCode = useMemo(() => {
    if (typeof params.code !== 'string') return '';
    return params.code.replace(/\s+/g, '').toUpperCase();
  }, [params.code]);

  useEffect(() => {
    if (loading) return;

    if (!invitationCode) {
      router.replace('/(auth)/login');
      return;
    }

    if (user?.id) {
      router.replace({
        pathname: '/account-linking',
        params: { invitationCode },
      });
      return;
    }

    router.replace({
      pathname: '/(auth)/login',
      params: { invitationCode },
    });
  }, [invitationCode, loading, user?.id]);

  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <ThemedBackground style={styles.background} resizeMode="repeat">
        <SafeAreaView style={styles.container}>
          <View style={styles.content}>
            <ActivityIndicator size="large" color="#E9C9B6" />
            <ThemedText style={styles.text}>
              {translateAuthText(ACTIVE_AUTH_LOCALE, 'invite.preparing')}
            </ThemedText>
          </View>
        </SafeAreaView>
      </ThemedBackground>
    </>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 24,
    gap: 16,
  },
  text: {
    fontSize: 16,
    color: '#7D5A50',
    textAlign: 'center',
  },
});
