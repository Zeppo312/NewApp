import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

export default function BlurTabBarBackground() {
  const adaptiveColors = useAdaptiveColors();

  // Nur bei dunklem Hintergrundbild: angepassten Blur verwenden
  if (adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground) {
    return (
      <View style={[StyleSheet.absoluteFill, { backgroundColor: adaptiveColors.tabBarBackground }]}>
        <BlurView
          tint="dark"
          intensity={80}
          style={StyleSheet.absoluteFill}
        />
      </View>
    );
  }

  // Standard (auch bei hellem custom Hintergrund): System Chrome Material
  return (
    <BlurView
      // System chrome material automatically adapts to the system's theme
      // and matches the native tab bar appearance on iOS.
      tint="systemChromeMaterial"
      intensity={100}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function useBottomTabOverflow() {
  const tabHeight = useBottomTabBarHeight();
  const { bottom } = useSafeAreaInsets();
  return tabHeight - bottom;
}
