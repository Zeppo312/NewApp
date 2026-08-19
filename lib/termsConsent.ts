import { getCachedUser, supabase } from './supabase';
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

/**
 * Speichert die Zustimmung des aktuell angemeldeten Nutzers.
 */
export const acceptTerms = async (): Promise<{ success: boolean; error?: string }> => {
  try {
    const { data: userData } = await getCachedUser();
    const userId = userData?.user?.id;
    if (!userId) return { success: false, error: 'not_authenticated' };

    // Upsert, weil das Profil bei sehr frühen Zustimmungen (direkt nach der
    // Registrierung) noch nicht existieren muss – sonst würde das Gate erneut
    // erscheinen, ohne dass die Zustimmung gespeichert wird.
    const { error } = await supabase.from('profiles').upsert(
      {
        id: userId,
        terms_accepted_at: new Date().toISOString(),
        terms_version: TERMS_VERSION,
      },
      { onConflict: 'id' },
    );

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
    const { data: userData } = await getCachedUser();
    const userId = userData?.user?.id;
    if (!userId) return { accepted: false, acceptedVersion: null, acceptedAt: null };

    const { data, error } = await supabase
      .from('profiles')
      .select('terms_accepted_at, terms_version')
      .eq('id', userId)
      .maybeSingle();

    if (error) {
      // Bei einem Netzwerkfehler nicht aussperren – der Gate-Screen würde sonst
      // dauerhaft blockieren. Der Check läuft beim nächsten Start erneut.
      console.error('termsConsent: failed to read acceptance', error);
      return { accepted: true, acceptedVersion: null, acceptedAt: null };
    }

    const acceptedAt = (data?.terms_accepted_at as string | null) ?? null;
    const acceptedVersion = (data?.terms_version as string | null) ?? null;

    return {
      accepted: !!acceptedAt && acceptedVersion === TERMS_VERSION,
      acceptedVersion,
      acceptedAt,
    };
  } catch (err) {
    console.error('termsConsent: unexpected error reading acceptance', err);
    return { accepted: true, acceptedVersion: null, acceptedAt: null };
  }
};
