import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

// Centralized design tokens and reusable glass components

export const LAYOUT_PAD = 20; // horizontal padding for containers
export const TIMELINE_INSET = 8; // horizontal inset for timeline-width cards
export const SECTION_GAP_TOP = 20;
export const SECTION_GAP_BOTTOM = 12;

export const RADIUS = 22;
export const PRIMARY = '#8E4EC6';
export const TEXT_PRIMARY = '#7D5A50';
export const GLASS_BORDER = 'rgba(255,255,255,0.55)';
export const GLASS_OVERLAY = 'rgba(255,255,255,0.16)';
export const GRID_GAP = 8;

// Adaptive Glass-Farben für dunkle Hintergrundbilder
export const GLASS_BORDER_DARK = 'rgba(255,255,255,0.25)';
export const GLASS_OVERLAY_DARK = 'rgba(0,0,0,0.35)';

export const FONT_SM = 12;
export const FONT_MD = 14;
export const FONT_LG = 18;

export const designTokens = {
  LAYOUT_PAD,
  TIMELINE_INSET,
  SECTION_GAP_TOP,
  SECTION_GAP_BOTTOM,
  RADIUS,
  PRIMARY,
  TEXT_PRIMARY,
  GLASS_BORDER,
  GLASS_OVERLAY,
  GLASS_BORDER_DARK,
  GLASS_OVERLAY_DARK,
  GRID_GAP,
  FONT_SM,
  FONT_MD,
  FONT_LG,
};

// Generic GlassCard wrapper
// Passt sich nur bei dunklem Hintergrundbild an
export function GlassCard({
  children,
  style,
  intensity = 26,
  overlayColor,
  borderColor,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  overlayColor?: string;
  borderColor?: string;
}) {
  const adaptiveColors = useAdaptiveColors();

  // Nur bei dunklem Hintergrundbild adaptive Farben verwenden
  const useDarkMode = adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground;

  const resolvedOverlayColor = overlayColor ?? (useDarkMode ? GLASS_OVERLAY_DARK : GLASS_OVERLAY);
  const resolvedBorderColor = borderColor ?? (useDarkMode ? GLASS_BORDER_DARK : GLASS_BORDER);
  const blurTint = useDarkMode ? 'dark' : 'light';

  return (
    <View style={[styles.glassContainer, { borderColor: resolvedBorderColor }, style]}>
      <BlurView style={StyleSheet.absoluteFill} intensity={intensity} tint={blurTint} />
      <View style={[styles.glassOverlay, { backgroundColor: resolvedOverlayColor }]} />
      {children}
    </View>
  );
}

// Tappable Liquid Glass Card (with inner overlay)
// Passt sich nur bei dunklem Hintergrundbild an
export const LiquidGlassCard: React.FC<{
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  overlayColor?: string;
  borderColor?: string;
  onPress?: () => void;
  activeOpacity?: number;
  radius?: number;
}> = ({
  children,
  style,
  intensity = 24,
  overlayColor,
  borderColor,
  onPress,
  activeOpacity = 0.9,
  radius,
}) => {
  const adaptiveColors = useAdaptiveColors();
  const CardComponent = onPress ? TouchableOpacity : View;
  const flattenedStyle = StyleSheet.flatten(style);
  const resolvedRadius = radius ?? flattenedStyle?.borderRadius ?? RADIUS;
  const radiusStyle = { borderRadius: resolvedRadius };

  // Nur bei dunklem Hintergrundbild adaptive Farben verwenden
  const useDarkMode = adaptiveColors.hasCustomBackground && adaptiveColors.isDarkBackground;

  const resolvedOverlayColor = overlayColor ?? (useDarkMode ? GLASS_OVERLAY_DARK : 'rgba(255,255,255,0.15)');
  const resolvedBorderColor = borderColor ?? (useDarkMode ? GLASS_BORDER_DARK : 'rgba(255,255,255,0.3)');
  const blurTint = useDarkMode ? 'dark' : 'light';

  return (
    <CardComponent
      // Defaults, dann externe Styles, der Radius liegt bewusst zuletzt
      style={[styles.liquidGlassWrapper, style, radiusStyle]}
      onPress={onPress}
      activeOpacity={activeOpacity}
    >
      <BlurView
        intensity={intensity}
        tint={blurTint}
        style={[styles.liquidGlassBackground as any, radiusStyle]}
      >
        <View style={[styles.liquidGlassContainer as any, { borderColor: resolvedBorderColor, borderRadius: resolvedRadius }]}>
          <View
            style={[styles.liquidGlassOverlay as any, { backgroundColor: resolvedOverlayColor, borderRadius: resolvedRadius }]}
          />
          {children}
        </View>
      </BlurView>
    </CardComponent>
  );
};

const styles = StyleSheet.create({
  glassContainer: {
    borderWidth: 1,
    borderRadius: RADIUS,
    overflow: 'hidden',
    position: 'relative',
  },
  glassOverlay: {
    ...StyleSheet.absoluteFillObject,
  },
  liquidGlassWrapper: {
    width: '100%',
    alignSelf: 'stretch',
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  liquidGlassBackground: {
    width: '100%',
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  liquidGlassContainer: {
    position: 'relative',
    borderWidth: 1,
    borderRadius: RADIUS,
    overflow: 'hidden',
  },
  liquidGlassOverlay: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: RADIUS,
  },
});
