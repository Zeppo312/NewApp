import { useEffect, useMemo, useState } from 'react';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as Linking from 'expo-linking';
import { AuthTransitionScreen } from '@/components/auth/auth-transition-screen';
import { useLocale } from '@/contexts/LocaleContext';
import { supabase } from '@/lib/supabase';
import { invalidateAllCaches } from '@/lib/appCache';
import { getOnboardingCompletionState } from '@/lib/onboarding';
import { translateAuthText, type AuthTranslationKey } from '@/lib/authTranslations';

export default function Callback() {
  const { locale } = useLocale();
  const router = useRouter();
  const [status, setStatus] = useState<AuthTranslationKey>('callback.confirming');
  const [failure, setFailure] = useState<AuthTranslationKey | null>(null);
  const searchParams = useLocalSearchParams();
  const rawUrl = Linking.useURL();
  const t = (key: AuthTranslationKey) => translateAuthText(locale, key);

  const rawUrlParams = useMemo(() => {
    const params: Record<string, string> = {};
    if (!rawUrl) return params;
    const [withoutHash, hashSegment] = rawUrl.split('#');
    for (const segment of [withoutHash.split('?')[1], hashSegment]) {
      if (segment) new URLSearchParams(segment).forEach((value, key) => { params[key] = value; });
    }
    return params;
  }, [rawUrl]);

  const first = (value: string | string[] | undefined) => Array.isArray(value) ? value[0] : value;
  const code = first(searchParams.code ?? rawUrlParams.code);
  const token = first(searchParams.token ?? rawUrlParams.token ?? searchParams.token_hash ?? rawUrlParams.token_hash);
  const type = first(searchParams.type ?? rawUrlParams.type);
  const accessToken = first(searchParams.access_token ?? rawUrlParams.access_token);
  const refreshToken = first(searchParams.refresh_token ?? rawUrlParams.refresh_token);
  const providerError = first(searchParams.error ?? rawUrlParams.error);
  const errorCode = first(searchParams.error_code ?? rawUrlParams.error_code);

  useEffect(() => {
    let active = true;
    const showError = (key: AuthTranslationKey) => { if (active) setFailure(key); };
    const handleAuthCallback = async () => {
      await Promise.resolve();
      if (!active) return;
      setFailure(null);
      setStatus('callback.confirming');
      // Supabase can fall back to this generic route when OAuth state expires.
      // Handle that error before considering any unrelated existing session.
      if (providerError || errorCode) {
        if (providerError === 'access_denied') showError('authTransition.cancelled');
        else if (['bad_oauth_state', 'flow_state_expired', 'flow_state_not_found', 'otp_expired'].includes(errorCode ?? '')) {
          showError('authTransition.expired');
        } else showError('authTransition.failedMessage');
        return;
      }

      try {
        const codeOrToken = code ?? token;
        if (codeOrToken) {
          setStatus('callback.processingLink');
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(codeOrToken);
          if (!active) return;
          if (exchangeError) {
            // Existing email links may carry token_hash instead of a PKCE code.
            if (type && token) {
              const { error: verifyError } = await supabase.auth.verifyOtp({ type: type as any, token_hash: token });
              if (!active) return;
              if (verifyError) { showError('callback.invalidLinkMessage'); return; }
            } else { showError('callback.invalidLinkMessage'); return; }
          }
        } else if (accessToken && refreshToken) {
          setStatus('callback.processingLink');
          const { error } = await supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
          if (!active) return;
          if (error) { showError('callback.invalidLinkMessage'); return; }
        }

        if (type?.toLowerCase() === 'recovery') {
          router.replace('/auth/reset-password');
          return;
        }

        const { data: { session }, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) { showError('authTransition.failedMessage'); return; }
        if (!session?.user) { showError('authTransition.noSession'); return; }

        await invalidateAllCaches();
        if (!active) return;
        const onboardingComplete = await getOnboardingCompletionState(session.user.id);
        if (!active) return;
        // No artificial success screen or delay: continue as soon as ready.
        router.replace(onboardingComplete ? '/' : '/(auth)/getUserInfo');
      } catch {
        showError('authTransition.failedMessage');
      }
    };

    void handleAuthCallback();
    return () => { active = false; };
  }, [accessToken, code, errorCode, providerError, refreshToken, router, token, type]);

  return <AuthTransitionScreen
    title={t(failure ? 'authTransition.failedTitle' : 'authTransition.title')}
    message={t(failure ?? status)} backLabel={t('common.backToLogin')}
    onBack={failure ? () => router.replace('/(auth)/login') : undefined}
  />;
}
