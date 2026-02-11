import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { getAppSettings, saveAppSettings } from '@/lib/supabase';
import { useAuth } from './AuthContext';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextType = {
  colorScheme: ColorSchemeName;
  themePreference: ThemeMode;
  setThemePreference: (theme: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({
  colorScheme: 'light',
  themePreference: 'light',
  setThemePreference: async () => {},
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
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>('light');

  // Laden der gespeicherten Themeneinstellung, sobald der Auth-Status feststeht.
  useEffect(() => {
    let isMounted = true;

    const loadThemePreference = async () => {
      if (authLoading) return;

      // Ohne angemeldeten Benutzer gilt immer der App-Standard (hell).
      if (!user) {
        if (isMounted) {
          setThemePreference('light');
          setColorScheme('light');
        }
        return;
      }

      try {
        const { data, error } = await getAppSettings();
        if (error) {
          console.error('Error loading theme preference:', error);
          if (isMounted) {
            setThemePreference('light');
          }
          return;
        }

        if (isMounted && data && data.theme) {
          setThemePreference(data.theme);
        } else if (isMounted) {
          setThemePreference('light');
        }
      } catch (err) {
        console.error('Failed to load theme preference:', err);
        if (isMounted) {
          setThemePreference('light');
        }
      }
    };

    loadThemePreference();

    return () => {
      isMounted = false;
    };
  }, [authLoading, user?.id]);

  // Aktualisieren des Farbschemas basierend auf der Themeneinstellung
  useEffect(() => {
    const updateColorScheme = () => {
      const systemColorScheme = Appearance.getColorScheme() ?? 'light';
      
      if (themePreference === 'system') {
        setColorScheme(systemColorScheme);
      } else {
        setColorScheme(themePreference);
      }
    };

    // Initial update
    updateColorScheme();

    // Listener für Systemänderungen hinzufügen
    const subscription = Appearance.addChangeListener(({ colorScheme: newColorScheme }) => {
      if (themePreference === 'system') {
        setColorScheme(newColorScheme);
      }
    });

    return () => {
      // Listener entfernen beim Unmount
      subscription.remove();
    };
  }, [themePreference]);

  // Funktion zum Ändern der Themeneinstellung
  const handleSetThemePreference = async (theme: ThemeMode) => {
    try {
      setThemePreference(theme);
      await saveAppSettings({ theme });
    } catch (err) {
      console.error('Failed to save theme preference:', err);
    }
  };

  return (
    <ThemeContext.Provider
      value={{
        colorScheme,
        themePreference,
        setThemePreference: handleSetThemePreference,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
};
