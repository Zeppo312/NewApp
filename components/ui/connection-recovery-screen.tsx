import React from 'react';
import { ActivityIndicator, Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

type Props = {
  testID: string;
  title: string;
  message: string;
  unavailable: boolean;
  retrying?: boolean;
  retryLabel: string;
  retryTestID: string;
  onRetry: () => void;
  secondaryLabel?: string;
  secondaryTestID?: string;
  onSecondaryPress?: () => void;
};

/** Shared presentation only; callers retain their startup and access decisions. */
export function ConnectionRecoveryScreen({
  testID, title, message, unavailable, retrying = false, retryLabel, retryTestID, onRetry,
  secondaryLabel, secondaryTestID, onSecondaryPress,
}: Props) {
  const colors = useAdaptiveColors();
  const insets = useSafeAreaInsets();
  const dark = colors.effectiveScheme === 'dark';
  const purple = dark ? '#D4BEFF' : '#5E3DB3';
  const busy = !unavailable || retrying;

  return (
    <View testID={testID} accessibilityViewIsModal style={{ flex: 1, backgroundColor: Colors[colors.effectiveScheme].background }}>
      <ThemedBackground style={{ width: '100%', height: '100%' }}>
        <ScrollView
          contentInsetAdjustmentBehavior="never"
          contentContainerStyle={{
            flexGrow: 1, justifyContent: 'center', alignItems: 'center', gap: 24,
            paddingHorizontal: 24, paddingTop: insets.top + 32, paddingBottom: insets.bottom + 32,
          }}
        >
          <Text style={{ color: colors.textSecondary, fontSize: 18, fontWeight: '600', letterSpacing: 0.4 }}>Lotti Baby</Text>
          <View style={{
            width: '100%', maxWidth: 440, padding: 28, gap: 20, alignItems: 'center',
            backgroundColor: dark ? 'rgba(45,37,34,0.97)' : 'rgba(255,252,248,0.97)',
            borderRadius: 32, borderCurve: 'continuous', borderWidth: 1,
            borderColor: dark ? 'rgba(255,255,255,0.18)' : 'rgba(255,255,255,0.95)',
            boxShadow: '0 12px 40px rgba(65,43,32,0.12)',
          }}>
            <View accessible={false} accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{
              width: 72, height: 72, borderRadius: 36, justifyContent: 'center', alignItems: 'center',
              backgroundColor: dark ? '#453951' : '#F0EAF7',
            }}>
              {busy ? <ActivityIndicator size="large" color={purple} /> : <IconSymbol name="wifi.slash" size={30} color={purple} />}
            </View>
            <View style={{ gap: 12, alignSelf: 'stretch' }}>
              <Text accessibilityRole="header" style={{ color: colors.textPrimary, fontSize: 26, lineHeight: 34, fontWeight: '700', textAlign: 'center' }}>{title}</Text>
              <Text accessibilityRole={unavailable ? 'alert' : undefined} accessibilityLiveRegion="polite" style={{ color: colors.textSecondary, fontSize: 16, lineHeight: 25, textAlign: 'center' }}>{message}</Text>
            </View>
            {unavailable && <View style={{ alignSelf: 'stretch', gap: 8, paddingTop: 4 }}>
              <Pressable
                testID={retryTestID} accessibilityRole="button" accessibilityState={{ disabled: retrying, busy: retrying }}
                disabled={retrying} onPress={onRetry}
                style={({ pressed }) => ({
                  minHeight: 52, paddingVertical: 14, paddingHorizontal: 16, justifyContent: 'center',
                  borderRadius: 18, borderCurve: 'continuous', backgroundColor: '#5E3DB3',
                  opacity: retrying ? 0.6 : pressed ? 0.85 : 1,
                })}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 16, lineHeight: 23, fontWeight: '600', textAlign: 'center' }}>{retryLabel}</Text>
              </Pressable>
              {onSecondaryPress && secondaryLabel && <Pressable
                testID={secondaryTestID} accessibilityRole="button" onPress={onSecondaryPress}
                style={({ pressed }) => ({ minHeight: 48, paddingVertical: 12, paddingHorizontal: 8, justifyContent: 'center', borderRadius: 16, opacity: pressed ? 0.65 : 1 })}
              >
                <Text style={{ color: colors.textSecondary, fontSize: 15, lineHeight: 23, fontWeight: '500', textAlign: 'center' }}>{secondaryLabel}</Text>
              </Pressable>}
            </View>}
          </View>
        </ScrollView>
      </ThemedBackground>
    </View>
  );
}
