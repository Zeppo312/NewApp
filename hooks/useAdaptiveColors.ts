/**
 * Hook für Farben, die sich an ein benutzerdefiniertes Hintergrundbild anpassen.
 * Wenn ein dunkles Hintergrundbild gesetzt ist, werden helle Textfarben verwendet und umgekehrt.
 */

import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useBackground } from '@/contexts/BackgroundContext';
import { useTheme } from '@/contexts/ThemeContext';

// Spezielle Farben für dunkle Hintergrundbilder (optimiert für Lesbarkeit)
const darkBackgroundColors = {
  // Textfarben - hell für dunkle Hintergründe
  text: '#FFFFFF',
  textPrimary: '#FFFFFF',
  textSecondary: '#F0E6DC',
  textTertiary: '#D4C4B5',
  textDisabled: '#A89888',

  // UI-Elemente
  icon: '#FFFFFF',
  iconSecondary: '#E8DED4',
  accent: '#E9C9B6', // Warmer Akzent, gut sichtbar auf dunkel
  tint: '#E9C9B6',
  success: '#A8D8A8',
  warning: '#FFD8A8',
  error: '#FF9A8A',

  // Borders und Overlays
  border: 'rgba(255, 255, 255, 0.2)',
  overlay: 'rgba(0, 0, 0, 0.4)',
  cardBackground: 'rgba(0, 0, 0, 0.35)',
  glassBackground: 'rgba(0, 0, 0, 0.25)',

  // Tab Bar
  tabBarBackground: 'rgba(30, 25, 22, 0.85)',
  tabIconDefault: '#B8A99A',
  tabIconSelected: '#E9C9B6',
};

// Spezielle Farben für helle Hintergrundbilder
const lightBackgroundColors = {
  // Textfarben - dunkel für helle Hintergründe
  text: '#5C4033',
  textPrimary: '#5C4033',
  textSecondary: '#7D5A50',
  textTertiary: '#9C8178',
  textDisabled: '#B0A59E',

  // UI-Elemente
  icon: '#7D5A50',
  iconSecondary: '#9C8178',
  accent: '#C89F81',
  tint: '#C89F81',
  success: '#9DBEBB',
  warning: '#E9C9B6',
  error: '#FF6B6B',

  // Borders und Overlays
  border: 'rgba(125, 90, 80, 0.15)',
  overlay: 'rgba(255, 255, 255, 0.4)',
  cardBackground: 'rgba(255, 255, 255, 0.7)',
  glassBackground: 'rgba(255, 255, 255, 0.5)',

  // Tab Bar
  tabBarBackground: 'rgba(255, 248, 240, 0.9)',
  tabIconDefault: '#9C8178',
  tabIconSelected: '#C89F81',
};

export type AdaptiveColors = typeof darkBackgroundColors;

export function useAdaptiveColors(): AdaptiveColors & {
  effectiveScheme: 'light' | 'dark';
  hasCustomBackground: boolean;
  isDarkBackground: boolean;
  systemColors: typeof Colors.light;
} {
  const systemColorScheme = useColorScheme() ?? 'light';
  const { hasCustomBackground, isDarkBackground } = useBackground();
  const { autoDarkModeEnabled } = useTheme();

  // Standardmäßig nur den gespeicherten Bildmodus für echte Hintergrundauswahl nutzen.
  const baseIsDarkBackground = hasCustomBackground ? isDarkBackground : false;

  // Wenn Auto-Dunkelmodus aktiv ist, folgt der Textmodus automatisch dem
  // Zeitfenster (dunkel nachts, hell tagsüber).
  const shouldSyncBackgroundModeWithAutoDark = autoDarkModeEnabled;
  const effectiveIsDarkBackground = shouldSyncBackgroundModeWithAutoDark
    ? systemColorScheme === 'dark'
    : baseIsDarkBackground;

  // Wenn ein custom Hintergrund gesetzt ist, verwende die speziellen Farben
  // Ansonsten verwenden wir das System-Farbschema
  const effectiveScheme = hasCustomBackground
    ? (effectiveIsDarkBackground ? 'dark' : 'light')
    : systemColorScheme;

  const systemColors = Colors[systemColorScheme];

  // Bei custom Hintergrund: spezielle optimierte Farben verwenden
  if (hasCustomBackground) {
    const adaptiveColors = effectiveIsDarkBackground ? darkBackgroundColors : lightBackgroundColors;
    return {
      ...adaptiveColors,
      effectiveScheme,
      hasCustomBackground,
      isDarkBackground: effectiveIsDarkBackground,
      systemColors,
    };
  }

  // Ohne custom Hintergrund: Standard-Farben aus Colors verwenden
  return {
    text: systemColors.text,
    textPrimary: systemColors.textPrimary,
    textSecondary: systemColors.textSecondary,
    textTertiary: systemColors.textTertiary,
    textDisabled: systemColors.textDisabled,
    icon: systemColors.icon,
    iconSecondary: systemColors.tabIconDefault,
    accent: systemColors.accent,
    tint: systemColors.tint,
    success: systemColors.success,
    warning: systemColors.warning,
    error: systemColors.error,
    border: systemColors.border,
    overlay: 'rgba(0, 0, 0, 0.1)',
    cardBackground: systemColors.card,
    glassBackground: 'rgba(255, 255, 255, 0.5)',
    tabBarBackground: systemColors.background,
    tabIconDefault: systemColors.tabIconDefault,
    tabIconSelected: systemColors.tabIconSelected,
    effectiveScheme,
    hasCustomBackground,
    isDarkBackground: effectiveIsDarkBackground,
    systemColors,
  };
}
