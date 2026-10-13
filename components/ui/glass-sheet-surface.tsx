import React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { ContentColors, LavenderColors, type SurfaceTone } from '@/constants/Colors';
import { GLASS_MATERIAL } from '@/constants/Materials';
import { useReduceTransparency } from '@/hooks/useReduceTransparency';

/** Keep form content outside the native blur view, within one rounded surface. */
export function GlassSheetSurface({
  children,
  isDark,
  tone = 'default',
  material,
  style,
  ...props
}: ViewProps & { isDark: boolean; tone?: SurfaceTone; material?: React.ReactNode }) {
  const lavender = LavenderColors[isDark ? 'dark' : 'light'];
  const content = ContentColors[isDark ? 'dark' : 'light'];
  const reduceTransparency = useReduceTransparency();
  return (
    <View
      {...props}
      style={[
        styles.surface,
        {
          backgroundColor: tone === 'lavender' ? lavender.surface : 'transparent',
          borderColor: tone === 'lavender' ? lavender.surfaceBorder : content.border,
        },
        material !== undefined && { backgroundColor: 'transparent', borderWidth: 0, boxShadow: 'none' },
        style,
      ]}
    >
      {material ?? <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {/* Android Modals use a separate window without a local BlurTargetView.
            Use the frosted gradient there instead of sampling the form itself. */}
        {Platform.OS !== 'android' && !reduceTransparency && (
          <BlurView style={StyleSheet.absoluteFill} intensity={GLASS_MATERIAL.sheetBlurIntensity} tint={isDark ? 'dark' : 'extraLight'} />
        )}
        {tone === 'default' && <View style={[StyleSheet.absoluteFill, {
          backgroundColor: reduceTransparency || Platform.OS === 'android' ? content.readableSurface : content.sheetSurface,
        }]} />}
        <LinearGradient
          colors={tone === 'lavender' ? lavender.gradient : content.gloss}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  surface: {
    width: '100%',
    maxWidth: 600,
    alignSelf: 'center',
    borderRadius: 32,
    borderCurve: 'continuous',
    borderWidth: 1,
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(35,25,20,0.14)',
  },
});
