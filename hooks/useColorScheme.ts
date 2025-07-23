import { useColorScheme as _useColorScheme } from 'react-native';
import { useTheme } from '@/contexts/ThemeContext';

// Dieser Hook gibt das Farbschema basierend auf den Benutzereinstellungen zurück
// und fällt auf das System-Farbschema zurück, wenn keine Einstellung vorhanden ist.
export function useColorScheme() {
  const { colorScheme } = useTheme();
  return colorScheme as 'light' | 'dark';
}
