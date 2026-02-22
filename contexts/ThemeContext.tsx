import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, AppState, ColorSchemeName } from 'react-native';
import { getAppSettings, saveAppSettings } from '@/lib/supabase';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';
const AUTO_DARK_MODE_STORAGE_KEY_PREFIX = '@auto_dark_mode_enabled:';
const AUTO_DARK_MODE_START_TIME_STORAGE_KEY_PREFIX = '@auto_dark_mode_start_time:';
const AUTO_DARK_MODE_END_TIME_STORAGE_KEY_PREFIX = '@auto_dark_mode_end_time:';
const DEFAULT_AUTO_DARK_START_TIME = '20:00';
const DEFAULT_AUTO_DARK_END_TIME = '07:00';

type ThemeContextType = {
  colorScheme: ColorSchemeName;
  themePreference: ThemeMode;
  autoDarkModeEnabled: boolean;
  autoDarkModeStartTime: string;
  autoDarkModeEndTime: string;
  setThemePreference: (theme: ThemeMode) => Promise<void>;
  setAutoDarkModeEnabled: (enabled: boolean) => Promise<void>;
  setAutoDarkModeStartTime: (time: string) => Promise<void>;
  setAutoDarkModeEndTime: (time: string) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({
  colorScheme: 'light',
  themePreference: 'light',
  autoDarkModeEnabled: false,
  autoDarkModeStartTime: DEFAULT_AUTO_DARK_START_TIME,
  autoDarkModeEndTime: DEFAULT_AUTO_DARK_END_TIME,
  setThemePreference: async () => {},
  setAutoDarkModeEnabled: async () => {},
  setAutoDarkModeStartTime: async () => {},
  setAutoDarkModeEndTime: async () => {},
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeOverrideProvider: React.FC<{
  children: React.ReactNode;
  colorScheme: 'light' | 'dark';
}> = ({ children, colorScheme }) => {
  const parentTheme = useTheme();

  return (
    <ThemeContext.Provider
      value={{
        ...parentTheme,
        colorScheme,
        themePreference: colorScheme,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user, loading: authLoading } = useAuth();
  const [themePreference, setThemePreference] = useState<ThemeMode>('light');
  const [autoDarkModeEnabled, setAutoDarkModeEnabledState] = useState(false);
  const [autoDarkModeStartTime, setAutoDarkModeStartTimeState] = useState(DEFAULT_AUTO_DARK_START_TIME);
  const [autoDarkModeEndTime, setAutoDarkModeEndTimeState] = useState(DEFAULT_AUTO_DARK_END_TIME);
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>('light');

  const parseTimeToMinutes = (time: string, fallbackTime: string) => {
    const match = time.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!match) {
      const fallbackMatch = fallbackTime.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
      if (!fallbackMatch) {
        return 0;
      }
      const fallbackHours = Number(fallbackMatch[1]);
      const fallbackMinutes = Number(fallbackMatch[2]);
      return fallbackHours * 60 + fallbackMinutes;
    }
    const hours = Number(match[1]);
    const minutes = Number(match[2]);
    return hours * 60 + minutes;
  };

  const isAutoDarkTime = (date: Date) => {
    const currentMinutes = date.getHours() * 60 + date.getMinutes();
    const startMinutes = parseTimeToMinutes(
      autoDarkModeStartTime,
      DEFAULT_AUTO_DARK_START_TIME,
    );
    const endMinutes = parseTimeToMinutes(
      autoDarkModeEndTime,
      DEFAULT_AUTO_DARK_END_TIME,
    );

    if (startMinutes === endMinutes) {
      return true;
    }

    if (startMinutes < endMinutes) {
      return currentMinutes >= startMinutes && currentMinutes < endMinutes;
    }

    return currentMinutes >= startMinutes || currentMinutes < endMinutes;
  };

  const resolveColorScheme = () => {
    if (autoDarkModeEnabled) {
      return isAutoDarkTime(new Date()) ? 'dark' : 'light';
    }

    const systemColorScheme = Appearance.getColorScheme() ?? 'light';
    return themePreference === 'system' ? systemColorScheme : themePreference;
  };

  const getAutoDarkModeStorageKey = (userId: string) => `${AUTO_DARK_MODE_STORAGE_KEY_PREFIX}${userId}`;
  const getAutoDarkStartTimeStorageKey = (userId: string) =>
    `${AUTO_DARK_MODE_START_TIME_STORAGE_KEY_PREFIX}${userId}`;
  const getAutoDarkEndTimeStorageKey = (userId: string) =>
    `${AUTO_DARK_MODE_END_TIME_STORAGE_KEY_PREFIX}${userId}`;

  const normalizeTimeString = (value: string, fallbackTime: string) => {
    return /^([01]\d|2[0-3]):([0-5]\d)$/.test(value) ? value : fallbackTime;
  };

  // Laden der gespeicherten Theme-/Auto-Dunkelmodus-Einstellungen, sobald der Auth-Status feststeht.
  useEffect(() => {
    let isMounted = true;

    const loadThemeSettings = async () => {
      if (authLoading) return;

      // Ohne angemeldeten Benutzer gilt immer der App-Standard (hell).
      if (!user) {
        if (isMounted) {
          setThemePreference('light');
          setAutoDarkModeEnabledState(false);
          setAutoDarkModeStartTimeState(DEFAULT_AUTO_DARK_START_TIME);
          setAutoDarkModeEndTimeState(DEFAULT_AUTO_DARK_END_TIME);
        }
        return;
      }

      try {
        const [settingsResult, savedAutoDarkMode, savedAutoDarkStartTime, savedAutoDarkEndTime] = await Promise.all([
          getAppSettings(),
          AsyncStorage.getItem(getAutoDarkModeStorageKey(user.id)),
          AsyncStorage.getItem(getAutoDarkStartTimeStorageKey(user.id)),
          AsyncStorage.getItem(getAutoDarkEndTimeStorageKey(user.id)),
        ]);
        const { data, error } = settingsResult;
        if (error) {
          console.error('Error loading theme preference:', error);
          if (isMounted) {
            setThemePreference('light');
            setAutoDarkModeEnabledState(savedAutoDarkMode === 'true');
            setAutoDarkModeStartTimeState(
              normalizeTimeString(savedAutoDarkStartTime ?? '', DEFAULT_AUTO_DARK_START_TIME),
            );
            setAutoDarkModeEndTimeState(
              normalizeTimeString(savedAutoDarkEndTime ?? '', DEFAULT_AUTO_DARK_END_TIME),
            );
          }
          return;
        }

        if (isMounted) {
          setThemePreference(data?.theme ?? 'light');
          setAutoDarkModeEnabledState(savedAutoDarkMode === 'true');
          setAutoDarkModeStartTimeState(
            normalizeTimeString(savedAutoDarkStartTime ?? '', DEFAULT_AUTO_DARK_START_TIME),
          );
          setAutoDarkModeEndTimeState(
            normalizeTimeString(savedAutoDarkEndTime ?? '', DEFAULT_AUTO_DARK_END_TIME),
          );
        }
      } catch (err) {
        console.error('Failed to load theme preference:', err);
        if (isMounted) {
          setThemePreference('light');
          setAutoDarkModeEnabledState(false);
          setAutoDarkModeStartTimeState(DEFAULT_AUTO_DARK_START_TIME);
          setAutoDarkModeEndTimeState(DEFAULT_AUTO_DARK_END_TIME);
        }
      }
    };

    loadThemeSettings();

    return () => {
      isMounted = false;
    };
  }, [authLoading, user?.id]);

  // Aktualisieren des Farbschemas basierend auf Theme + Auto-Dunkelmodus
  useEffect(() => {
    const updateColorScheme = () => {
      setColorScheme(resolveColorScheme());
    };

    updateColorScheme();

    const appearanceSubscription = Appearance.addChangeListener(() => {
      if (!autoDarkModeEnabled && themePreference === 'system') {
        updateColorScheme();
      }
    });

    const appStateSubscription = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') {
        updateColorScheme();
      }
    });

    const timer = autoDarkModeEnabled ? setInterval(updateColorScheme, 60 * 1000) : null;

    return () => {
      appearanceSubscription.remove();
      appStateSubscription.remove();
      if (timer) {
        clearInterval(timer);
      }
    };
  }, [themePreference, autoDarkModeEnabled, autoDarkModeStartTime, autoDarkModeEndTime]);

  // Funktion zum Ändern der Themeneinstellung
  const handleSetThemePreference = async (theme: ThemeMode) => {
    try {
      setThemePreference(theme);
      await saveAppSettings({ theme });
    } catch (err) {
      console.error('Failed to save theme preference:', err);
    }
  };

  const handleSetAutoDarkModeEnabled = async (enabled: boolean) => {
    try {
      setAutoDarkModeEnabledState(enabled);

      if (user?.id) {
        await AsyncStorage.setItem(
          getAutoDarkModeStorageKey(user.id),
          enabled ? 'true' : 'false',
        );
      }
    } catch (err) {
      console.error('Failed to save auto dark mode preference:', err);
    }
  };

  const handleSetAutoDarkModeStartTime = async (time: string) => {
    try {
      const normalized = normalizeTimeString(time, DEFAULT_AUTO_DARK_START_TIME);
      setAutoDarkModeStartTimeState(normalized);

      if (user?.id) {
        await AsyncStorage.setItem(getAutoDarkStartTimeStorageKey(user.id), normalized);
      }
    } catch (err) {
      console.error('Failed to save auto dark mode start time:', err);
    }
  };

  const handleSetAutoDarkModeEndTime = async (time: string) => {
    try {
      const normalized = normalizeTimeString(time, DEFAULT_AUTO_DARK_END_TIME);
      setAutoDarkModeEndTimeState(normalized);

      if (user?.id) {
        await AsyncStorage.setItem(getAutoDarkEndTimeStorageKey(user.id), normalized);
      }
    } catch (err) {
      console.error('Failed to save auto dark mode end time:', err);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        themePreference,
        autoDarkModeEnabled,
        autoDarkModeStartTime,
        autoDarkModeEndTime,
        setThemePreference: handleSetThemePreference,
        setAutoDarkModeEnabled: handleSetAutoDarkModeEnabled,
        setAutoDarkModeStartTime: handleSetAutoDarkModeStartTime,
        setAutoDarkModeEndTime: handleSetAutoDarkModeEndTime,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
