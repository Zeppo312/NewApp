import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, AppState, ColorSchemeName } from 'react-native';
import { getAppSettings, saveAppSettings } from '@/lib/supabase';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';
const AUTO_DARK_MODE_STORAGE_KEY_PREFIX = '@auto_dark_mode_enabled:';

type ThemeContextType = {
  colorScheme: ColorSchemeName;
  themePreference: ThemeMode;
  autoDarkModeEnabled: boolean;
  setThemePreference: (theme: ThemeMode) => Promise<void>;
  setAutoDarkModeEnabled: (enabled: boolean) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({
  colorScheme: 'light',
  themePreference: 'light',
  autoDarkModeEnabled: false,
  setThemePreference: async () => {},
  setAutoDarkModeEnabled: async () => {},
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
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>('light');

  const isAutoDarkTime = (date: Date) => {
    const currentHour = date.getHours();
    return currentHour >= 20 || currentHour < 7;
  };

  const resolveColorScheme = () => {
    if (autoDarkModeEnabled) {
      return isAutoDarkTime(new Date()) ? 'dark' : 'light';
    }

    const systemColorScheme = Appearance.getColorScheme() ?? 'light';
    return themePreference === 'system' ? systemColorScheme : themePreference;
  };

  const getAutoDarkModeStorageKey = (userId: string) => `${AUTO_DARK_MODE_STORAGE_KEY_PREFIX}${userId}`;

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
        }
        return;
      }

      try {
        const [settingsResult, savedAutoDarkMode] = await Promise.all([
          getAppSettings(),
          AsyncStorage.getItem(getAutoDarkModeStorageKey(user.id)),
        ]);
        const { data, error } = settingsResult;
        if (error) {
          console.error('Error loading theme preference:', error);
          if (isMounted) {
            setThemePreference('light');
            setAutoDarkModeEnabledState(savedAutoDarkMode === 'true');
          }
          return;
        }

        if (isMounted) {
          setThemePreference(data?.theme ?? 'light');
          setAutoDarkModeEnabledState(savedAutoDarkMode === 'true');
        }
      } catch (err) {
        console.error('Failed to load theme preference:', err);
        if (isMounted) {
          setThemePreference('light');
          setAutoDarkModeEnabledState(false);
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
  }, [themePreference, autoDarkModeEnabled]);

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

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        themePreference,
        autoDarkModeEnabled,
        setThemePreference: handleSetThemePreference,
        setAutoDarkModeEnabled: handleSetAutoDarkModeEnabled,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
