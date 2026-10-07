import React from 'react';
import { Platform, StyleSheet, View, type ViewProps } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';

/** Keep form content outside the native blur view, within one rounded surface. */
export function GlassSheetSurface({
  children,
  isDark,
  style,
  ...props
}: ViewProps & { isDark: boolean }) {
  return (
    <View
      {...props}
      style={[
        styles.surface,
        {
          backgroundColor: isDark ? 'rgba(35,31,32,0.96)' : 'rgba(248,245,241,0.96)',
          borderColor: isDark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.86)',
        },
        style,
      ]}
    >
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {/* Android Modals use a separate window without a local BlurTargetView.
            Use the frosted gradient there instead of sampling the form itself. */}
        {Platform.OS !== 'android' && (
          <BlurView style={StyleSheet.absoluteFill} intensity={70} tint={isDark ? 'dark' : 'extraLight'} />
        )}
        <LinearGradient
          colors={isDark
            ? ['rgba(255,255,255,0.09)', 'rgba(35,31,32,0.18)', 'rgba(229,185,160,0.06)']
            : ['rgba(255,255,255,0.74)', 'rgba(255,255,255,0.32)', 'rgba(239,220,207,0.24)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={StyleSheet.absoluteFill}
        />
      </View>
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
