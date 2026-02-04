/**
 * Hook für Farben, die sich an ein benutzerdefiniertes Hintergrundbild anpassen.
 * Wenn ein dunkles Hintergrundbild gesetzt ist, werden helle Textfarben verwendet und umgekehrt.
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useBackground } from '@/contexts/BackgroundContext';

export function useAdaptiveColors() {
  const systemColorScheme = useColorScheme() ?? 'light';
  const { hasCustomBackground, isDarkBackground } = useBackground();

  // Wenn ein custom Hintergrund gesetzt ist, basieren die Farben auf isDarkBackground
  // Ansonsten verwenden wir das System-Farbschema
  const effectiveScheme = hasCustomBackground
    ? (isDarkBackground ? 'dark' : 'light')
    : systemColorScheme;

  const colors = Colors[effectiveScheme];

  return {
    // Textfarben
    text: colors.text,
    textPrimary: colors.textPrimary,
    textSecondary: colors.textSecondary,
    textTertiary: colors.textTertiary,

    // UI-Farben
    icon: colors.icon,
    accent: colors.accent,
    tint: colors.tint,

    // Meta-Informationen
    effectiveScheme,
    hasCustomBackground,
    isDarkBackground,
  };
}
