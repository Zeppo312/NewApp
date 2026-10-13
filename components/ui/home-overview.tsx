import React from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { TYPOGRAPHY } from '@/constants/Typography';
import { androidHomeShadow } from './home-glass';

/** Shared with both Home modes so their overview chrome stays identical. */
export function HomeOverviewHeading({ children, color }: { children: string; color: string }) {
  return (
    <View style={styles.heading}>
      <ThemedText adaptive={false} accessibilityRole="header" style={[styles.title, { color }]}>
        {children}
      </ThemedText>
      <View style={styles.chevron}>
        <IconSymbol name="chevron.right" size={20} color={color} />
      </View>
    </View>
  );
}

export function HomeCarouselDots({ count, index, dark, onSelect, getLabel }: {
  count: number;
  index: number;
  dark: boolean;
  onSelect?: (index: number) => void;
  getLabel?: (index: number) => string;
}) {
  const inactive = dark ? 'rgba(255, 255, 255, 0.25)' : 'rgba(107, 76, 59, 0.25)';
  const active = dark ? Colors.dark.text : '#6B4C3B';

  return (
    <View style={styles.dots}>
      {Array.from({ length: count }, (_, dot) => {
        const style = [styles.dot, { backgroundColor: index === dot ? active : inactive }];
        return onSelect ? (
          <TouchableOpacity
            key={dot}
            style={style}
            hitSlop={{ top: 19, bottom: 19, left: 4, right: 4 }}
            accessibilityRole="button"
            accessibilityLabel={getLabel?.(dot)}
            accessibilityState={{ selected: index === dot }}
            onPress={() => onSelect(dot)}
          />
        ) : <View key={dot} style={style} />;
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { ...TYPOGRAPHY.sectionTitle, flex: 1, minWidth: 0, marginRight: 8 },
  chevron: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)', borderRadius: 12, padding: 8, borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15, shadowRadius: 4, elevation: 3, ...androidHomeShadow,
  },
  dots: { flexDirection: 'row', justifyContent: 'center', marginTop: 10 },
  dot: { width: 6, height: 6, borderRadius: 3, marginHorizontal: 4 },
});
