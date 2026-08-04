import AsyncStorage from '@react-native-async-storage/async-storage';
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { AppState } from 'react-native';

import { useAuth } from '@/contexts/AuthContext';
import {
  DEFAULT_LANGUAGE_PREFERENCE,
  getAppLocaleTag,
  getDeviceAppLocale,
  LANGUAGE_PREFERENCE_STORAGE_KEY,
  isLanguagePreference,
  resolveAppLocale,
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
  const [preference, setPreferenceState] = useState<LanguagePreference>(
    DEFAULT_LANGUAGE_PREFERENCE,
  );
  const [deviceLocale, setDeviceLocale] = useState<AppLocale>(getDeviceAppLocale);
  const [isLocalPreferenceLoaded, setIsLocalPreferenceLoaded] = useState(false);
  const [isAccountPreferenceLoaded, setIsAccountPreferenceLoaded] = useState(false);

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

  useEffect(() => {
    if (authLoading || !isLocalPreferenceLoaded) return;

    if (!user?.id) {
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
          return AsyncStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, accountPreference);
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
  }, [authLoading, isLocalPreferenceLoaded, user?.id]);

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

    await AsyncStorage.setItem(LANGUAGE_PREFERENCE_STORAGE_KEY, nextPreference);

    if (user?.id) {
      const { error } = await saveAppSettings({
        language_preference: nextPreference,
        resolved_language: resolveAppLocale(nextPreference, getDeviceAppLocale()),
      });
      if (error) throw error;
    }
  }, [user?.id]);

  const locale = resolveAppLocale(preference, deviceLocale);

  useEffect(() => {
    if (!user?.id || !isLocalPreferenceLoaded || !isAccountPreferenceLoaded) return;
    void saveAppSettings({ resolved_language: locale }).then(({ error }) => {
      if (error) console.warn('Failed to sync resolved app language:', error);
    });
  }, [isAccountPreferenceLoaded, isLocalPreferenceLoaded, locale, user?.id]);

  const value = useMemo<LocaleContextValue>(() => ({
    locale,
    localeTag: getAppLocaleTag(locale),
    preference,
    isLocaleReady: isLocalPreferenceLoaded && (authLoading || isAccountPreferenceLoaded),
    setPreference,
  }), [
    authLoading,
    isAccountPreferenceLoaded,
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
