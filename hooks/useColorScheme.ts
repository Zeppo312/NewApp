import { useColorScheme as _useColorScheme } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

// Dieser Hook gibt das Farbschema basierend auf den Benutzereinstellungen zurück
// und fällt auf das System-Farbschema zurück, wenn keine Einstellung vorhanden ist.
export function useColorScheme() {
  const { colorScheme } = useTheme();
  // Invert the color scheme so that the app renders dark when the user selects
  // light mode and vice versa. Default to 'light' when no scheme is available.
  if (colorScheme === 'light') {
    return 'dark';
  }
  if (colorScheme === 'dark') {
    return 'light';
  }
  return 'light';
}
