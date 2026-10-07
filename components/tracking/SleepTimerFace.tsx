import React from 'react';
import { Platform, StyleSheet, Text, View } from 'react-native';
import { BlurView } from 'expo-blur';
import { ProgressCircle } from '@/components/ProgressCircle';
import { IconSymbol } from '@/components/ui/IconSymbol';

export type SleepTimerFaceProps = {
  size: number;
  active: boolean;
  progress: number;
  timeLabel: string;
  textColor: string;
  children?: React.ReactNode;
};

/** The sleep tracker's clock face, shared with its local onboarding preview. */
export function SleepTimerFace({ size, active, progress, timeLabel, textColor, children }: SleepTimerFaceProps) {
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return <View style={[styles.circleArea, circle]}>
    <View style={[styles.glassCircle, circle]}>
      <BlurView intensity={18} tint="light" style={[styles.glassCircleBlur, { borderRadius: size / 2 }]}>
        <View style={[styles.glassCircleOverlay, { borderRadius: size / 2 }]} />
      </BlurView>
    </View>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.progressAbsolute, { width: size, height: size }]}>
      <ProgressCircle progress={progress} size={size} strokeWidth={8} progressColor={active ? '#87CEEB' : 'rgba(135,206,235,0.4)'} backgroundColor="rgba(135,206,235,0.2)" showPercentage={false} />
    </View>
    <View pointerEvents="none" style={styles.centerOverlay}><Text style={[styles.centralTime, { color: textColor, fontWeight: '800' }]}>{timeLabel}</Text></View>
    <View pointerEvents="none" style={styles.upperContent}>
      <View style={[styles.centralIcon, { backgroundColor: active ? 'rgba(135,206,235,0.9)' : 'rgba(255,140,66,0.9)' }]}>
        <IconSymbol name={active ? 'moon.fill' : 'sun.max.fill'} size={28} color="#FFFFFF" />
      </View>
    </View>
    <View pointerEvents="none" style={styles.lowerContent}>{children}</View>
  </View>;
}
const styles = StyleSheet.create({
  circleArea: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  glassCircle: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  glassCircleBlur: { flex: 1 },
  glassCircleOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(135,206,235,0.1)', borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)' },
  progressAbsolute: { position: 'absolute', top: 0, left: 0 },
  centerOverlay: { ...StyleSheet.absoluteFill, alignItems: 'center', justifyContent: 'center' },
  upperContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: '60%', alignItems: 'center', justifyContent: 'center' },
  lowerContent: { position: 'absolute', top: '60%', left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 },
  centralIcon: { width: 54, height: 54, borderRadius: 30, justifyContent: 'center', alignItems: 'center', padding: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', shadowColor: 'rgba(255,255,255,0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: .12, shadowRadius: 2, elevation: 4 },
  centralTime: { fontSize: 32, fontWeight: '900', letterSpacing: 0, textAlign: 'center', lineHeight: 32, fontFamily: Platform.OS === 'ios' ? 'SF Pro Display' : 'Roboto', textAlignVertical: 'center', includeFontPadding: false, fontVariant: ['tabular-nums'] },
});
