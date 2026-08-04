/* eslint-disable react-hooks/globals -- module helpers share the single app-wide locale */
import { useLocale } from '@/contexts/LocaleContext';
import { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { supabase } from '@/lib/supabase';
import { ThemedText } from '@/components/ThemedText';
import { ThemedBackground } from '@/components/ThemedBackground';
import { invalidateAllCaches } from '@/lib/appCache';
import { getOnboardingCompletionState } from '@/lib/onboarding';
import {
  AuthTranslationKey,
  DEFAULT_AUTH_LOCALE,
  translateAuthText,
} from '@/lib/authTranslations';

let ACTIVE_AUTH_LOCALE = DEFAULT_AUTH_LOCALE;
const t = (key: AuthTranslationKey, params?: Record<string, string | number>) =>
  translateAuthText(ACTIVE_AUTH_LOCALE, key, params);

export default function Callback() {
  ACTIVE_AUTH_LOCALE = useLocale().locale;
  const router = useRouter();
  const [status, setStatus] = useState(t('callback.confirming'));
  const searchParams = useLocalSearchParams();
  const rawUrl = Linking.useURL();

  const rawUrlParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (!rawUrl) return params;

    const parseSegment = (segment?: string) => {
      if (!segment) return;
      const parsed = new URLSearchParams(segment);
      parsed.forEach((value, key) => {
        params[key] = value;
      });
    };

    const [withoutHash, hashSegment] = rawUrl.split('#');
    const querySegment = withoutHash.split('?')[1];
    parseSegment(querySegment);
    parseSegment(hashSegment);

    return params;
  }, [rawUrl]);

  const code = useMemo(() => {
    const raw = searchParams.code ?? rawUrlParams.code;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [rawUrlParams.code, searchParams.code]);

  const token = useMemo(() => {
    const raw =
      searchParams.token ??
      rawUrlParams.token ??
      searchParams.token_hash ??
      rawUrlParams.token_hash;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [rawUrlParams.token, rawUrlParams.token_hash, searchParams.token, searchParams.token_hash]);

  const type = useMemo(() => {
    const raw = searchParams.type ?? rawUrlParams.type;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [rawUrlParams.type, searchParams.type]);

  const accessToken = useMemo(() => {
    const raw = searchParams.access_token ?? rawUrlParams.access_token;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [rawUrlParams.access_token, searchParams.access_token]);

  const refreshToken = useMemo(() => {
    const raw = searchParams.refresh_token ?? rawUrlParams.refresh_token;
    return Array.isArray(raw) ? raw[0] : raw;
  }, [rawUrlParams.refresh_token, searchParams.refresh_token]);

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // PKCE: Code aus Deep Link gegen Session tauschen (z.B. signup/recovery)
        const codeOrToken = code ?? token;

        if (codeOrToken) {
          setStatus(t('callback.processingLink'));
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(codeOrToken);

          if (exchangeError) {
            // Fallback: Manche Links liefern token_hash statt code.
            const canVerifyTokenHash = !!type && !!token;
            if (canVerifyTokenHash) {
              const { error: verifyError } = await supabase.auth.verifyOtp({
                type: type as any,
                token_hash: token!,
              });
              if (!verifyError) {
                // token_hash erfolgreich verifiziert -> weiter im Flow
              } else {
                console.error('Auth code exchange error:', exchangeError);
                console.error('Auth token hash verify error:', verifyError);
                setStatus(t('callback.confirmationErrorStatus'));
                Alert.alert(
                  t('callback.failedTitle'),
                  t('callback.invalidLinkMessage'),
                  [
                    {
                      text: t('common.backToLogin'),
                      onPress: () => router.replace('/(auth)/login'),
                    },
                  ],
                );
                return;
              }
            } else {
              console.error('Auth code exchange error:', exchangeError);
              setStatus(t('callback.confirmationErrorStatus'));
              Alert.alert(
                t('callback.failedTitle'),
                t('callback.invalidLinkMessage'),
                [
                  {
                    text: t('common.backToLogin'),
                    onPress: () => router.replace('/(auth)/login'),
                  },
                ],
              );
              return;
            }
          }
        }
        // Manche Provider liefern Tokens direkt im URL-Hash statt `code`.
        else if (accessToken && refreshToken) {
          setStatus(t('callback.processingLink'));
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });
          if (setSessionError) {
            console.error('Auth token session error:', setSessionError);
            setStatus(t('callback.confirmationErrorStatus'));
            Alert.alert(
              t('callback.failedTitle'),
              t('callback.invalidLinkMessage'),
              [
                {
                  text: t('common.backToLogin'),
                  onPress: () => router.replace('/(auth)/login'),
                },
              ],
            );
            return;
          }
        }

        // Recovery-Link: direkt zur Passwort-Änderung weiterleiten
        if (type?.toLowerCase() === 'recovery') {
          setStatus(t('callback.preparingReset'));
          router.replace('/auth/reset-password' as any);
          return;
        }

        // Prüfen des aktuellen Auth-Status
        const { data: { session }, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          setStatus(t('callback.confirmationErrorStatus'));
          Alert.alert(
            t('callback.failedTitle'),
            t('callback.emailFailedMessage'),
            [
              { 
                text: t('common.backToLogin'),
                onPress: () => router.replace('/(auth)/login')
              }
            ]
          );
          return;
        }

        if (session?.user) {
          setStatus(t('callback.emailConfirmed'));

          await invalidateAllCaches();
          const onboardingComplete = await getOnboardingCompletionState();

          // Kurz warten für bessere UX
          setTimeout(() => {
            if (!onboardingComplete) {
              // Neuer User -> Onboarding
              router.replace('/(auth)/getUserInfo');
            } else {
              // Bestehender User -> zentraler Root-Guard entscheidet über Startscreen
              router.replace('/');
            }
          }, 2000);
        } else {
          setStatus(t('callback.noSession'));
          setTimeout(() => {
            router.replace('/(auth)/login');
          }, 2000);
        }
      } catch (err) {
        console.error('Callback processing error:', err);
        setStatus(t('callback.unexpectedError'));
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2000);
      }
    };

    // Initial check
    handleAuthCallback();
  }, [accessToken, code, refreshToken, router, token, type]);

  return (
    <ThemedBackground style={styles.backgroundImage} resizeMode="repeat">
      <SafeAreaView style={styles.container}>
        <View style={styles.content}>
          <ThemedText style={styles.icon}>✅</ThemedText>
          <ThemedText type="title" style={styles.title}>
            {t('callback.title')}
          </ThemedText>
          <ThemedText style={styles.status}>
            {status}
          </ThemedText>
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  backgroundImage: {
    flex: 1,
  },
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  content: {
    alignItems: 'center',
  },
  icon: {
    fontSize: 64,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    marginBottom: 16,
    textAlign: 'center',
    fontWeight: '600',
  },
  status: {
    fontSize: 16,
    textAlign: 'center',
    opacity: 0.8,
  },
});
