// This is a shim for web and Android where the tab bar is generally opaque.
import { View, StyleSheet } from 'react-native';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

export default function TabBarBackground() {
  const adaptiveColors = useAdaptiveColors();

  // Nur bei dunklem Hintergrundbild: angepassten Hintergrund verwenden
  if (adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: adaptiveColors.tabBarBackground }]} />
    );
  }

  // Standard (auch bei hellem custom Hintergrund): transparent
  return null;
}

export function useBottomTabOverflow() {
  return 0;
}
