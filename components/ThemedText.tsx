import { Text, type TextProps, StyleSheet } from 'react-native';

import { useThemeColor } from '@/hooks/useThemeColor';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { Colors } from '@/constants/Colors';

export type ThemedTextProps = TextProps & {
  lightColor?: string;
  darkColor?: string;
  type?: 'default' | 'title' | 'defaultSemiBold' | 'subtitle' | 'link';
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
        type === 'default' ? styles.default : undefined,
        type === 'title' ? styles.title : undefined,
        type === 'defaultSemiBold' ? styles.defaultSemiBold : undefined,
        type === 'subtitle' ? styles.subtitle : undefined,
        type === 'link' ? [styles.link, { color: linkColor }] : undefined,
        style,
      ]}
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  default: {
    fontSize: 16,
    lineHeight: 24,
  },
  defaultSemiBold: {
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '600',
  },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    lineHeight: 40, // Erhöhte Zeilenhöhe, um Buchstaben mit Überlängen Platz zu geben
  },
  subtitle: {
    fontSize: 20,
    fontWeight: 'bold',
  },
  link: {
    lineHeight: 30,
    fontSize: 16,
    color: '#0a7ea4',
  },
});
