import { supabase } from './supabase';
import { invalidateUserProfileCache } from './appCache';

/**
 * Zustimmung zu den Nutzungsbedingungen (EULA-Gate, App Store Guideline 1.2).
 *
 * Die Version wird mitgespeichert, damit eine spätere inhaltliche Änderung der
 * Community-Regeln erneut bestätigt werden kann.
 */
export const TERMS_VERSION = '2026-08-17';

export type TermsConsentState = {
  accepted: boolean;
  acceptedVersion: string | null;
  acceptedAt: string | null;
};

export type TermsConsentSource = 'signup' | 'login' | 'otp' | 'gate';

/**
 * Speichert die Zustimmung des aktuell angemeldeten Nutzers.
 */
export const acceptTerms = async (
  source: TermsConsentSource = 'gate',
  expectedUserId?: string,
): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (userError || !userId || (expectedUserId && expectedUserId !== userId)) {
      return { success: false, error: 'not_authenticated' };
    }

    const { error } = await supabase.rpc('record_terms_consent', {
      terms_version_param: TERMS_VERSION,
      source_param: source,
    });

    if (error) {
      console.error('termsConsent: failed to store acceptance', error);
      return { success: false, error: error.message };
    }

    await invalidateUserProfileCache();
    return { success: true };
  } catch (err) {
    console.error('termsConsent: unexpected error storing acceptance', err);
    return { success: false, error: 'unexpected_error' };
  }
};

/**
 * Liest den Zustimmungsstand direkt aus der Datenbank (nicht aus dem Cache,
 * damit das Gate nach dem Zustimmen nicht erneut erscheint).
 */
export const getTermsConsentState = async (): Promise<TermsConsentState> => {
  try {
    const { data: userData, error: userError } = await supabase.auth.getUser();
    const userId = userData?.user?.id;
    if (userError || !userId) {
      return { accepted: false, acceptedVersion: null, acceptedAt: null };
    }

    const { data, error } = await supabase
      .from('terms_consents')
      .select('accepted_at, terms_version')
      .eq('user_id', userId)
      .eq('terms_version', TERMS_VERSION)
      .maybeSingle();

    if (error) {
      console.error('termsConsent: failed to read acceptance', error);
      return { accepted: false, acceptedVersion: null, acceptedAt: null };
    }

    const acceptedAt = (data?.accepted_at as string | null) ?? null;
    const acceptedVersion = (data?.terms_version as string | null) ?? null;

    return {
      accepted: !!acceptedAt && acceptedVersion === TERMS_VERSION,
      acceptedVersion,
      acceptedAt,
    };
  } catch (err) {
    console.error('termsConsent: unexpected error reading acceptance', err);
    return { accepted: false, acceptedVersion: null, acceptedAt: null };
  }
};
