import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { BlurView } from 'expo-blur';

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
  FONT_SM,
  FONT_MD,
  FONT_LG,
};

// Generic GlassCard wrapper
export function GlassCard({
  children,
  style,
  intensity = 26,
  overlayColor = GLASS_OVERLAY,
  borderColor = GLASS_BORDER,
}: {
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  overlayColor?: string;
  borderColor?: string;
}) {
  return (
    <View style={[styles.glassContainer, { borderColor }, style]}>
      <BlurView style={StyleSheet.absoluteFill} intensity={intensity} tint="light" />
      <View style={[styles.glassOverlay, { backgroundColor: overlayColor }]} />
      {children}
    </View>
  );
}

// Tappable Liquid Glass Card (with inner overlay)
export const LiquidGlassCard: React.FC<{
  children: React.ReactNode;
  style?: any;
  intensity?: number;
  overlayColor?: string;
  borderColor?: string;
  onPress?: () => void;
  activeOpacity?: number;
}> = ({
  children,
  style,
  intensity = 24,
  overlayColor = 'rgba(255,255,255,0.15)',
  borderColor = 'rgba(255,255,255,0.3)',
  onPress,
  activeOpacity = 0.9,
}) => {
  const CardComponent = onPress ? TouchableOpacity : View;
  return (
    <CardComponent
      style={[styles.liquidGlassWrapper, style]}
      onPress={onPress}
      activeOpacity={activeOpacity}
    >
      <BlurView
        intensity={intensity}
        tint="light"
        style={styles.liquidGlassBackground as any}
      >
        <View style={[styles.liquidGlassContainer as any, { borderColor }]}>
          <View
            style={[styles.liquidGlassOverlay as any, { backgroundColor: overlayColor }]}
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
