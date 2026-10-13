import { useBottomTabBarHeight } from 'expo-router/js-tabs';
import { BlurView } from 'expo-blur';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

export default function BlurTabBarBackground() {
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark';

  // Der Blur muss dem App-Theme folgen. `systemChromeMaterial` richtet sich
  // stattdessen nach dem iOS-Theme und kann dadurch im App-Nachtmodus hell sein.
  return (
    <View style={[StyleSheet.absoluteFill, { backgroundColor: adaptiveColors.tabBarBackground }]}>
      <BlurView
        tint={isDark ? 'dark' : 'light'}
        intensity={isDark ? 80 : 100}
        style={StyleSheet.absoluteFill}
      />
    </View>
  );
}

export function useBottomTabOverflow() {
  const tabHeight = useBottomTabBarHeight();
  const { bottom } = useSafeAreaInsets();
  return tabHeight - bottom;
}
