import React from 'react';
import { View, StyleSheet, TouchableOpacity } from 'react-native';
import { ContentGlassMaterial } from '@/components/ui/content-glass-material';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { TYPOGRAPHY } from '@/constants/Typography';
import { ActionColors, ContentColors } from '@/constants/Colors';
import { ACTION_BUTTON_LAYOUT } from '@/constants/Actions';
import { GLASS_MATERIAL } from '@/constants/Materials';

export { TYPOGRAPHY } from '@/constants/Typography';
export type { TextRole } from '@/constants/Typography';
export { ACTION_BUTTON_LAYOUT } from '@/constants/Actions';
export { GLASS_MATERIAL } from '@/constants/Materials';

// Centralized design tokens and reusable glass components

export const LAYOUT_PAD = 20; // horizontal padding for containers
export const TIMELINE_INSET = 8; // horizontal inset for timeline-width cards
export const SECTION_GAP_TOP = 20;
export const SECTION_GAP_BOTTOM = 12;

export const RADIUS = 22;
export const PRIMARY = ActionColors.light.primary;
// Helles Brand-Lila für Icons und Text auf dunklen bzw. getönten Flächen.
export const PRIMARY_DARK_FOREGROUND = '#E9D5FF';
export const TEXT_PRIMARY = '#7D5A50';
export const GLASS_BORDER = ContentColors.light.border;
export const GLASS_OVERLAY = ContentColors.light.surface;
export const GRID_GAP = 8;

// Shared rhythm for Home and the two everyday tracking screens.
export const CONTENT_LAYOUT = {
  edge: LAYOUT_PAD,
  cardPadding: 20,
  compactPadding: 16,
  sectionGap: 24,
  itemGap: 12,
  cardRadius: RADIUS,
  innerRadius: 16,
  cardShadow: '0 4px 16px rgba(35,25,20,0.08)',
} as const;
export const METRIC_TEXT = { ...TYPOGRAPHY.dialogTitle, fontVariant: ['tabular-nums' as const] };
export const METRIC_TEXT_LARGE = { ...TYPOGRAPHY.display, fontVariant: ['tabular-nums' as const] };

// Adaptive Glass-Farben für dunkle Hintergrundbilder
export const GLASS_BORDER_DARK = ContentColors.dark.border;
export const GLASS_OVERLAY_DARK = ContentColors.dark.surface;

export const FONT_SM = TYPOGRAPHY.caption.fontSize;
export const FONT_MD = TYPOGRAPHY.bodySmall.fontSize;
export const FONT_LG = TYPOGRAPHY.headline.fontSize;

export const designTokens = {
  LAYOUT_PAD,
  TIMELINE_INSET,
  SECTION_GAP_TOP,
  SECTION_GAP_BOTTOM,
  RADIUS,
  PRIMARY,
  PRIMARY_DARK_FOREGROUND,
  TEXT_PRIMARY,
  GLASS_BORDER,
  GLASS_OVERLAY,
  GLASS_BORDER_DARK,
  GLASS_OVERLAY_DARK,
  GRID_GAP,
  FONT_SM,
  FONT_MD,
  FONT_LG,
  TYPOGRAPHY,
  ACTION_BUTTON_LAYOUT,
  CONTENT_LAYOUT,
  GLASS_MATERIAL,
  METRIC_TEXT,
  METRIC_TEXT_LARGE,
};

// Generic GlassCard wrapper
// Kompatibler Wrapper mit dem gemeinsamen hellen/dunklen Kartenmaterial.
export function GlassCard({
  children,
  style,
  intensity = GLASS_MATERIAL.contentBlurIntensity,
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

  const useDarkMode = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;

  const resolvedBorderColor = borderColor ?? (useDarkMode ? GLASS_BORDER_DARK : GLASS_BORDER);
  const resolvedRadius = StyleSheet.flatten(style)?.borderRadius ?? RADIUS;

  return (
    <View style={[styles.glassContainer, { borderColor: resolvedBorderColor }, style]}>
      <ContentGlassMaterial intensity={intensity} overlayColor={overlayColor} isDark={useDarkMode} radius={resolvedRadius} />
      {children}
    </View>
  );
}

// Tappable Liquid Glass Card (with inner overlay)
// Gleiche Materialrollen wie ContentCard, mit bestehender Touchable-Schnittstelle.
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
  intensity = GLASS_MATERIAL.contentBlurIntensity,
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

  const useDarkMode = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;

  const resolvedBorderColor = borderColor ?? (useDarkMode ? GLASS_BORDER_DARK : GLASS_BORDER);

  return (
    <CardComponent
      // Defaults, dann externe Styles, der Radius liegt bewusst zuletzt
      style={[styles.liquidGlassWrapper, style, radiusStyle]}
      onPress={onPress}
      activeOpacity={activeOpacity}
    >
        <View style={[styles.liquidGlassContainer as any, { borderColor: resolvedBorderColor, borderRadius: resolvedRadius }]}>
          <ContentGlassMaterial intensity={intensity} overlayColor={overlayColor} isDark={useDarkMode} radius={resolvedRadius} />
          {children}
        </View>
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
    ...StyleSheet.absoluteFill,
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
    ...StyleSheet.absoluteFill,
    borderRadius: RADIUS,
  },
});
