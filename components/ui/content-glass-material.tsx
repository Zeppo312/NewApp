import React from 'react';
import { ContentColors } from '@/constants/Colors';
import { GLASS_MATERIAL } from '@/constants/Materials';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';
import { GlassMaterial } from './GlassCard';
import { HomeGlassSurface, useHomeBlurAvailable } from './home-glass';

/** One frosted material for reading cards, legacy cards and the sleep clock. */
export function ContentGlassMaterial({ radius = GLASS_MATERIAL.defaultRadius,
  intensity = GLASS_MATERIAL.contentBlurIntensity, variant = 'card', frostColor, overlayColor, isDark }: {
  radius?: number;
  intensity?: number;
  frostColor?: string;
  variant?: 'card' | 'timer';
  overlayColor?: string;
  isDark?: boolean;
}) {
  const adaptive = useAdaptiveColors();
  const dark = isDark ?? (adaptive.effectiveScheme === 'dark' || adaptive.isDarkBackground);
  const palette = ContentColors[dark ? 'dark' : 'light'];
  const blurAvailable = useHomeBlurAvailable();
  const reduceTransparency = useReduceTransparency();
  // Only an unavailable blur or an explicit accessibility setting needs dense frost.
  const needsReadingBase = !blurAvailable || reduceTransparency;
  const surface = variant === 'timer' ? palette.timerSurface : palette.surface;
  const photoSurface = variant === 'timer' ? palette.photoTimerSurface : palette.photoSurface;
  // Legacy GLASS_OVERLAY aliases identify the base, not an additional tint layer.
  const toneColor = overlayColor === ContentColors.light.surface || overlayColor === ContentColors.dark.surface
    ? undefined : overlayColor;
  return <GlassMaterial radius={radius} BlurComponent={HomeGlassSurface}
    intensity={Math.max(GLASS_MATERIAL.contentBlurIntensity, intensity)}
    tint={dark ? 'dark' : 'light'} skipBlur={!blurAvailable || reduceTransparency}
    frostColor={needsReadingBase ? palette.readableSurface : adaptive.isPhotoBackground ? photoSurface : frostColor ?? surface}
    toneColor={toneColor} innerBorderColor={palette.innerBorder}
    highlightStrength="subtle" highlightOpacity={GLASS_MATERIAL.highlightOpacity}
    glossOpacity={GLASS_MATERIAL.glossOpacity} grainOpacity={0} shadeOpacity={GLASS_MATERIAL.shadeOpacity} />;
}
