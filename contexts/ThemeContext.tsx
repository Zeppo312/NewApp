import React, { createContext, useContext, useEffect, useState } from 'react';
import { Appearance, ColorSchemeName } from 'react-native';
import { getAppSettings, saveAppSettings } from '@/lib/supabase';

type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextType = {
  colorScheme: ColorSchemeName;
  themePreference: ThemeMode;
  setThemePreference: (theme: ThemeMode) => Promise<void>;
};

const ThemeContext = createContext<ThemeContextType>({
  colorScheme: 'light',
  themePreference: 'system',
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
  const [themePreference, setThemePreference] = useState<ThemeMode>('system');
  const [colorScheme, setColorScheme] = useState<ColorSchemeName>(Appearance.getColorScheme());

  // Laden der gespeicherten Themeneinstellung beim Start
  useEffect(() => {
    const loadThemePreference = async () => {
      try {
        const { data, error } = await getAppSettings();
        if (error) {
          console.error('Error loading theme preference:', error);
          return;
        }

        if (data && data.theme) {
          setThemePreference(data.theme);
        }
      } catch (err) {
        console.error('Failed to load theme preference:', err);
      }
    };

    loadThemePreference();
  }, []);

  // Aktualisieren des Farbschemas basierend auf der Themeneinstellung
  useEffect(() => {
    const updateColorScheme = () => {
      const systemColorScheme = Appearance.getColorScheme();
      
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
