import { useEffect, useRef, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthTransitionScreen } from '@/components/auth/auth-transition-screen';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { translateAuthText, type AuthTranslationKey } from '@/lib/authTranslations';
import { finishGoogleSignIn, GoogleAuthError, googleAuthErrorKey, GOOGLE_CALLBACK_PATH } from '@/lib/google-auth';
import { getOnboardingCompletionState } from '@/lib/onboarding';
import { acceptTerms, TERMS_VERSION } from '@/lib/termsConsent';

export default function GoogleCallbackScreen() {
  const { locale } = useLocale();
  const router = useRouter();
  const { completeGoogleSignIn, signOut } = useAuth();
  const params = useLocalSearchParams<{ attempt?: string; code?: string; error?: string }>();
  const rawUrl = Linking.useURL();
  const [failure, setFailure] = useState<{ url: string | null; key: AuthTranslationKey } | null>(null);
  const handlers = useRef({ completeGoogleSignIn, signOut, router });
  useEffect(() => {
    handlers.current = { completeGoogleSignIn, signOut, router };
  }, [completeGoogleSignIn, signOut, router]);
  const t = (key: Parameters<typeof translateAuthText>[1]) => translateAuthText(locale, key);
  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  // The browser result may be routed before Linking.useURL receives the link.
  const attempt = first(params.attempt);
  const code = first(params.code);
  const providerError = first(params.error);
  const callbackUrl = attempt
    ? Linking.createURL(GOOGLE_CALLBACK_PATH, {
        scheme: 'com.lottibaby.app',
        queryParams: { attempt, ...(code ? { code } : {}), ...(providerError ? { error: providerError } : {}) },
      })
    : rawUrl;
  const error = failure?.url === callbackUrl ? failure.key : null;

  useEffect(() => {
    let active = true;
    const { completeGoogleSignIn: complete, signOut: logout, router: navigation } = handlers.current;
    const showError = (key: AuthTranslationKey) => { if (active) setFailure({ url: callbackUrl, key }); };
    void (async () => {
      await Promise.resolve();
      if (!active) return;
      if (!callbackUrl) { showError('login.googleExpired'); return; }
      try {
        const { session, attempt: intent } = await complete(callbackUrl);
        if (!active) return;
        // Consent comes only from our persisted local intent, never from URL flags.
        if (intent.termsVersion === TERMS_VERSION) {
          const consent = await acceptTerms(intent.source, session.user.id);
          if (!consent.success) {
            await logout();
            showError('login.termsSaveFailed');
            return;
          }
        }
        const onboardingComplete = await getOnboardingCompletionState(session.user.id);
        if (!active) return;
        await finishGoogleSignIn(intent.id);
        if (!active) return;
        const invitationParams = intent.invitationCode ? { invitationCode: intent.invitationCode } : {};
        if (!onboardingComplete) {
          navigation.replace({ pathname: '/(auth)/getUserInfo', params: invitationParams });
        } else if (intent.invitationCode) {
          navigation.replace({ pathname: '/account-linking', params: invitationParams });
        } else {
          navigation.replace('/');
        }
      } catch (failure) {
        if (!active) return;
        if (failure instanceof GoogleAuthError && failure.code === 'cancelled') {
          navigation.replace('/(auth)/login');
        } else {
          showError(googleAuthErrorKey(failure));
        }
      }
    })();
    return () => { active = false; };
  }, [callbackUrl]);

  return <AuthTransitionScreen
    title={t(error ? 'authTransition.failedTitle' : 'authTransition.title')}
    message={t(error ?? 'googleCallback.processing')} backLabel={t('common.backToLogin')}
    onBack={error ? () => router.replace('/(auth)/login') : undefined}
  />;
}
