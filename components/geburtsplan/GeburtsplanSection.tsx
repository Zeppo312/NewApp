import React from 'react';
import { StyleSheet, View, StyleProp, ViewStyle } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LiquidGlassCard, GLASS_OVERLAY, RADIUS } from '@/constants/DesignGuide';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';

interface GeburtsplanSectionProps {
  title: string;
  children: React.ReactNode;
  containerStyle?: StyleProp<ViewStyle>;
}

export const GeburtsplanSection: React.FC<GeburtsplanSectionProps> = ({ title, children, containerStyle }) => {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];

  return (
    <LiquidGlassCard style={[styles.sectionGlass, containerStyle]} intensity={26} overlayColor={GLASS_OVERLAY}>
      <ThemedText type="defaultSemiBold" style={styles.sectionTitle}>
        {title}
      </ThemedText>
      <View style={styles.sectionContent}>
        {children}
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  sectionGlass: {
    borderRadius: RADIUS,
    overflow: 'hidden',
    marginBottom: 16,
    // WICHTIG: keine feste Breite/alignSelf hier! Kein Padding auf dem Wrapper,
    // damit die Außenbreite exakt durch marginHorizontal (TIMELINE_INSET) definiert wird.
  },
  sectionTitle: {
    fontSize: 18,
    marginBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.55)',
    paddingBottom: 8,
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
});
