import React from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { ContentColors } from '@/constants/Colors';
import { CONTENT_LAYOUT } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { GLASS_MATERIAL } from '@/constants/Materials';
import { ContentGlassMaterial } from './content-glass-material';

type Props = {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
  intensity?: number;
  overlayColor?: string;
  borderColor?: string;
  radius?: number;
  onPress?: () => void;
  activeOpacity?: number;
};

/** The same quiet reading surface for Home, Unser Tag and Schlaf.
 * Blur is decorative; a readable base remains on Android and over photos.
 * Children are outside the blur layer so they never become its blur source.
 */
export function ContentCard({ children, style, intensity = GLASS_MATERIAL.contentBlurIntensity, overlayColor, borderColor,
  radius, onPress, activeOpacity = 0.9 }: Props) {
  const adaptive = useAdaptiveColors();
  const dark = adaptive.effectiveScheme === 'dark' || adaptive.isDarkBackground;
  const palette = ContentColors[dark ? 'dark' : 'light'];
  const styleRadius = StyleSheet.flatten(style)?.borderRadius;
  const resolvedRadius = radius ?? (typeof styleRadius === 'number' ? styleRadius : CONTENT_LAYOUT.cardRadius);
  const content = <>
    <ContentGlassMaterial radius={resolvedRadius} intensity={intensity} overlayColor={overlayColor} isDark={dark} />
    {children}
  </>;
  const cardStyle = [styles.card, { borderColor: borderColor ?? palette.border }, style,
    { borderRadius: resolvedRadius, borderCurve: 'continuous' as const }];
  return onPress
    ? <Pressable onPress={onPress} accessibilityRole="button"
        style={({ pressed }) => [cardStyle, pressed && { opacity: activeOpacity }]}>{content}</Pressable>
    : <View style={cardStyle}>{content}</View>;
}

const styles = StyleSheet.create({
  card: { borderWidth: 1, overflow: 'hidden', boxShadow: CONTENT_LAYOUT.cardShadow },
});
