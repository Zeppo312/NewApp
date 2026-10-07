import React, { type ComponentProps } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { GlassCard } from '@/components/ui/GlassCard';

/** The long care screen uses a single frosted surface per card on Android. */
export function CareGlassCard(props: ComponentProps<typeof GlassCard>) {
  if (Platform.OS !== 'android') return <GlassCard {...props} />;

  const {
    children,
    style,
    contentStyle,
    radius = 22,
    borderWidth = 1.5,
    shadow = true,
    tint = 'light',
  } = props;
  const isDark = tint === 'dark';
  const innerRadius = Math.max(0, radius - borderWidth);

  // Keep the shadow outside the clip. No elevation, SVG grain/highlights or
  // native BlurView: translucent nested layers otherwise leave hard outlines.
  return (
    <View
      style={[
        style,
        {
          borderRadius: radius,
          borderWidth,
          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.72)',
          backgroundColor: isDark ? '#211B2C' : '#F8F4ED',
          elevation: 0,
          shadowOpacity: 0,
          boxShadow: shadow
            ? isDark
              ? '0 4px 12px rgba(0,0,0,0.22)'
              : '0 4px 12px rgba(74,58,51,0.10)'
            : 'none',
        },
      ]}
    >
      <View style={{ borderRadius: innerRadius, overflow: 'hidden' }}>
        <LinearGradient
          pointerEvents="none"
          colors={isDark ? ['#2B2239', '#211B2C'] : ['#FCFAF5', '#F4EFE7']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: innerRadius }]}
        />
        <View style={[styles.content, contentStyle]}>{children}</View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20 },
});
