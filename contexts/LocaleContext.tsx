import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_LANGUAGE_PREFERENCE,
  getAppLocaleTag,
  getDeviceAppLocale,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  getUserLanguagePreferenceStorageKey,
  isLanguagePreference,
  resolveAppLocale,
  resolvePreferenceForUser,
  type AppLocale,
  type LanguagePreference,
} from '@/lib/localization';
import { getAppSettings, saveAppSettings } from '@/lib/supabase';

type LocaleContextValue = {
  locale: AppLocale;
  localeTag: string;
  preference: LanguagePreference;
  isLocaleReady: boolean;
  setPreference: (preference: LanguagePreference) => Promise<void>;
};

const LocaleContext = createContext<LocaleContextValue | null>(null);

export const LocaleProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const userId = user?.id ?? null;
  const [preference, setPreferenceState] = useState<LanguagePreference>(
    DEFAULT_LANGUAGE_PREFERENCE,
  );
  const [deviceLocale, setDeviceLocale] = useState<AppLocale>(getDeviceAppLocale);
  const [isLocalPreferenceLoaded, setIsLocalPreferenceLoaded] = useState(false);
  const [isAccountPreferenceLoaded, setIsAccountPreferenceLoaded] = useState(false);
  // Fuer welchen Nutzer die aktuell angezeigte Praeferenz gilt. undefined =
  // seit App-Start noch kein Nutzer aufgeloest.
  const preferenceUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    let cancelled = false;

    AsyncStorage.getItem(LANGUAGE_PREFERENCE_STORAGE_KEY)
      .then((storedPreference) => {
        if (!cancelled && isLanguagePreference(storedPreference)) {
          setPreferenceState(storedPreference);
        }
      })
      .catch((error) => {
        console.warn('Failed to load language preference:', error);
      })
      .finally(() => {
        if (!cancelled) setIsLocalPreferenceLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Praeferenz global (zuletzt aktiv, fuer Background-Code ohne Nutzerkontext)
  // und zusaetzlich nutzerspezifisch ablegen.
  const persistPreference = useCallback(
    async (nextPreference: LanguagePreference, forUserId: string | null) => {
      const writes = [AsyncStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, nextPreference)];
      if (forUserId) {
        writes.push(
          AsyncStorage.setItem(getUserLanguagePreferenceStorageKey(forUserId), nextPreference),
        );
      }
      await Promise.all(writes);
    },
    [],
  );

  // Nutzerwechsel: die fuer diesen Nutzer gespeicherte Praeferenz anwenden.
  // Ohne gespeicherten Wert faellt ein echter Wechsel auf den Standard zurueck,
  // damit nicht die Sprache des vorherigen Accounts stehen bleibt.
  useEffect(() => {
    if (authLoading || !isLocalPreferenceLoaded) return;

    if (!userId) {
      preferenceUserIdRef.current = null;
      return;
    }

    if (preferenceUserIdRef.current === userId) return;

    const previousUserId = preferenceUserIdRef.current;
    preferenceUserIdRef.current = userId;

    let cancelled = false;

    AsyncStorage.getItem(getUserLanguagePreferenceStorageKey(userId))
      .then((storedPreference) => {
        if (cancelled) return;

        if (isLanguagePreference(storedPreference)) {
          setPreferenceState(storedPreference);
          return;
        }

        // Beim ersten Aufloesen nach App-Start hat der globale Schluessel
        // bereits den richtigen Wert. Nur ein echter Wechsel muss zuruecksetzen.
        if (previousUserId && previousUserId !== userId) {
          setPreferenceState(resolvePreferenceForUser(storedPreference));
        }
      })
      .catch((error) => {
        console.warn('Failed to load per-user language preference:', error);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isLocalPreferenceLoaded, userId]);

  // Account-Praeferenz wird im Hintergrund abgeglichen. Sie haelt die Anzeige
  // bewusst nicht mehr auf - das war der Netzwerk-Roundtrip, der den Splash
  // zusaetzlich blockiert hat.
  useEffect(() => {
    if (authLoading || !isLocalPreferenceLoaded) return;

    if (!userId) {
      setIsAccountPreferenceLoaded(true);
      return;
    }

    let cancelled = false;
    setIsAccountPreferenceLoaded(false);

    getAppSettings()
      .then(({ data }) => {
        const accountPreference = data?.language_preference;
        if (!cancelled && isLanguagePreference(accountPreference)) {
          setPreferenceState(accountPreference);
          return persistPreference(accountPreference, userId);
        }
        return undefined;
      })
      .catch((error) => {
        console.warn('Failed to load account language preference:', error);
      })
      .finally(() => {
        if (!cancelled) setIsAccountPreferenceLoaded(true);
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, isLocalPreferenceLoaded, persistPreference, userId]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active' && preference === 'system') {
        setDeviceLocale(getDeviceAppLocale());
      }
    });
    return () => subscription.remove();
  }, [preference]);

  const setPreference = useCallback(async (nextPreference: LanguagePreference) => {
    setPreferenceState(nextPreference);
    if (nextPreference === 'system') {
      setDeviceLocale(getDeviceAppLocale());
    }

    await persistPreference(nextPreference, userId);

    if (userId) {
      const { error } = await saveAppSettings({
        language_preference: nextPreference,
        resolved_language: resolveAppLocale(nextPreference, getDeviceAppLocale()),
      });
      if (error) throw error;
    }
  }, [persistPreference, userId]);

  const locale = resolveAppLocale(preference, deviceLocale);

  useEffect(() => {
    if (!userId || !isLocalPreferenceLoaded || !isAccountPreferenceLoaded) return;
    void saveAppSettings({ resolved_language: locale }).then(({ error }) => {
      if (error) console.warn('Failed to sync resolved app language:', error);
    });
  }, [isAccountPreferenceLoaded, isLocalPreferenceLoaded, locale, userId]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    localeTag: getAppLocaleTag(locale),
    preference,
    // Nur lokaler Zustand. Der Account-Abgleich laeuft im Hintergrund weiter.
    isLocaleReady: isLocalPreferenceLoaded,
    setPreference,
  }), [
    isLocalPreferenceLoaded,
    locale,
    preference,
    setPreference,
  ]);

  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
};

export const useLocale = () => {
  const value = useContext(LocaleContext);
  if (!value) throw new Error('useLocale must be used within LocaleProvider');
  return value;
};
