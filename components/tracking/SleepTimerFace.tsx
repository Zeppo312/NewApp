import React, { useRef } from 'react';
import { Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { TYPOGRAPHY } from '@/constants/Typography';
import { ContentGlassMaterial } from '@/components/ui/content-glass-material';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { ProgressCircle } from '@/components/ProgressCircle';
import { IconSymbol } from '@/components/ui/IconSymbol';

export type SleepTimerFaceProps = {
  size: number;
  active: boolean;
  progress: number;
  timeLabel: string;
  textColor: string;
  children?: React.ReactNode;
  pending?: boolean;
  onStart?: () => void | Promise<unknown>;
  startLabel?: string;
  startHint?: string;
  startDisabled?: boolean;
};

/** The sleep tracker's clock face, shared with its local onboarding preview. */
export function SleepTimerFace({ size, active, progress, timeLabel, textColor, children, pending = false,
  onStart, startLabel, startHint, startDisabled = false }: SleepTimerFaceProps) {
  const adaptive = useAdaptiveColors();
  const dark = adaptive.effectiveScheme === 'dark' || adaptive.isDarkBackground;
  const { fontScale } = useWindowDimensions();
  const startInFlight = useRef(false);
  const offersStart = Boolean(onStart && startLabel && !active);
  const disabled = startDisabled || pending;
  const start = async () => {
    if (!offersStart || disabled || startInFlight.current) return;
    startInFlight.current = true;
    try {
      await onStart?.();
    } finally {
      startInFlight.current = false;
    }
  };
  // Keep the familiar compact clock at normal size; let larger text flow below it.
  const detailsOutside = fontScale >= 1.3;
  const circle = { width: size, height: size, borderRadius: size / 2 };
  return <View style={[styles.timer, { width: size }]}>
    <View style={[styles.circleArea, circle]}>
    <View style={[styles.glassCircle, circle]}>
      <ContentGlassMaterial radius={size / 2} isDark={dark} variant="timer" />
    </View>
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={[styles.progressAbsolute, { width: size, height: size }]}>
      <ProgressCircle progress={progress} size={size} strokeWidth={8} progressColor={active ? '#87CEEB' : 'rgba(135,206,235,0.4)'} backgroundColor="rgba(135,206,235,0.2)" showPercentage={false} />
    </View>
    <View pointerEvents="none" style={styles.centerOverlay}><Text maxFontSizeMultiplier={1.4} style={[styles.centralTime, pending && TYPOGRAPHY.bodyStrong, { color: textColor }]}>{timeLabel}</Text></View>
    <View pointerEvents="none" style={styles.upperContent}>
      <View style={[styles.centralIcon, { backgroundColor: active ? 'rgba(135,206,235,0.9)' : 'rgba(255,140,66,0.9)' }]}>
        <IconSymbol name={active ? 'moon.fill' : 'sun.max.fill'} size={28} color="#FFFFFF" />
      </View>
    </View>
    {!detailsOutside && <View pointerEvents="none" style={styles.lowerContent}>{children}</View>}
    {offersStart && <Pressable
      accessibilityRole="button" accessibilityLabel={startLabel} accessibilityHint={startHint}
      accessibilityState={{ disabled, busy: pending }} disabled={disabled} onPress={start}
      style={({ pressed }) => [StyleSheet.absoluteFill, { borderRadius: size / 2 }, pressed && styles.clockPressed]}
    />}
    </View>
    {detailsOutside && children && <View style={styles.details}>{children}</View>}
  </View>;
}
const styles = StyleSheet.create({
  timer: { alignItems: 'center' },
  circleArea: { position: 'relative', alignItems: 'center', justifyContent: 'center' },
  glassCircle: { ...StyleSheet.absoluteFill, overflow: 'hidden' },
  progressAbsolute: { position: 'absolute', top: 0, left: 0 },
  centerOverlay: { ...StyleSheet.absoluteFill, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  upperContent: { position: 'absolute', top: 0, left: 0, right: 0, bottom: '60%', alignItems: 'center', justifyContent: 'center' },
  lowerContent: { position: 'absolute', top: '60%', left: 12, right: 12, bottom: 0, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 8 },
  details: { alignSelf: 'stretch', alignItems: 'center', gap: 4, paddingTop: 12 },
  clockPressed: { backgroundColor: 'rgba(135,206,235,0.16)' },
  centralIcon: { width: 54, height: 54, borderRadius: 30, justifyContent: 'center', alignItems: 'center', padding: 8, borderWidth: 2, borderColor: 'rgba(255,255,255,0.6)', shadowColor: 'rgba(255,255,255,0.3)', shadowOffset: { width: 0, height: 1 }, shadowOpacity: .12, shadowRadius: 2, elevation: 4 },
  centralTime: { ...TYPOGRAPHY.timer, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false },
});
