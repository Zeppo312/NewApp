import { Text, type TextProps, StyleSheet } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';
import { TYPOGRAPHY, type TextRole } from '@/constants/Typography';

/** Bestehende Namen bleiben als Aliasse verfügbar. */
export type ThemedTextType = TextRole | 'default' | 'title' | 'defaultSemiBold' | 'subtitle';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  /** Semantische Textrolle; neue Aufrufer verwenden die Namen aus TYPOGRAPHY. */
  type?: ThemedTextType;
  /**
   * Wenn true, passt sich die Textfarbe an das benutzerdefinierte Hintergrundbild an.
   * Bei dunklem Hintergrund wird heller Text verwendet und umgekehrt.
   */
  adaptive?: boolean;
};

export function ThemedText({
  style,
  lightColor,
  darkColor,
  type = 'default',
  adaptive = true, // Standardmäßig adaptiv für automatische Anpassung an Hintergrundbilder
  ...rest
}: ThemedTextProps) {
  const colorScheme = useColorScheme() ?? 'light';
  const themeColor = useThemeColor({ light: lightColor, dark: darkColor }, 'text');
  const adaptiveColors = useAdaptiveColors();

  // Nur bei dunklem Hintergrundbild die adaptive Farbe verwenden
  // Bei hellem Hintergrund oder ohne custom Hintergrund: normale Farben
  const hasExplicitColor = lightColor !== undefined || darkColor !== undefined;
  const useDarkMode = adaptive && adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground;
  const color = (useDarkMode && !hasExplicitColor)
    ? adaptiveColors.text
    : themeColor;

  // Helle Link-Farbe für Dark Mode
  const linkColor = colorScheme === 'dark' ? Colors.dark.textAccent : '#0a7ea4';

  return (
    <Text
      style={[
        { color },
        styles[type],
        type === 'link' ? { color: linkColor } : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  ...TYPOGRAPHY,
  // Der bisherige Standard erbt bei verschachteltem Text das Schriftgewicht.
  // Explizites type="body" verwendet hingegen das vollständige Rollenprofil.
  default: {
    fontSize: TYPOGRAPHY.body.fontSize,
    lineHeight: TYPOGRAPHY.body.lineHeight,
  },
  defaultSemiBold: TYPOGRAPHY.bodyStrong,
  title: TYPOGRAPHY.display,
  subtitle: TYPOGRAPHY.sectionTitle,
});
