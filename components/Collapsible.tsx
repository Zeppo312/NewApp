import { PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LiquidGlassCard, TEXT_PRIMARY } from '@/constants/DesignGuide';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';

export function Collapsible({
  children,
  title,
  subtitle,
  initiallyExpanded = false,
  leftComponent
}: PropsWithChildren & {
  title: string,
  subtitle?: string,
  initiallyExpanded?: boolean,
  leftComponent?: React.ReactNode
}) {
  const [isOpen, setIsOpen] = useState(initiallyExpanded);
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const titleColor = isDark ? adaptiveColors.textPrimary : TEXT_PRIMARY;
  const subtitleColor = isDark ? adaptiveColors.textSecondary : 'rgba(125,90,80,0.75)';
  const iconColor = isDark ? adaptiveColors.icon : titleColor;
  const borderColor = isDark ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.35)';
  const overlayColor = isDark ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.15)';

  return (
    <LiquidGlassCard style={styles.card} borderColor={borderColor} overlayColor={overlayColor}>
      <View>
        <TouchableOpacity
          style={styles.heading}
          onPress={() => setIsOpen((value) => !value)}
          activeOpacity={0.85}>
          {leftComponent && (
            <View style={styles.leftComponentContainer}>
              {leftComponent}
            </View>
          )}
          <View style={styles.titleContainer}>
            <ThemedText style={[styles.title, { color: titleColor }]}>
              {title}
            </ThemedText>
            {subtitle && (
              <ThemedText style={[styles.subtitle, { color: subtitleColor }]}>
                {subtitle}
              </ThemedText>
            )}
          </View>
          <IconSymbol
            name="chevron.right"
            size={18}
            weight="medium"
            color={iconColor}
            style={{ transform: [{ rotate: isOpen ? '90deg' : '0deg' }] }}
          />
        </TouchableOpacity>
        {isOpen && (
          <View style={[styles.content, { borderTopColor: borderColor }]}>
            {children}
          </View>
        )}
      </View>
    </LiquidGlassCard>
  );
}

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  heading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 18,
    gap: 14,
  },
  leftComponentContainer: {
    marginRight: 10,
  },
  titleContainer: {
    flex: 1,
  },
  title: {
    fontSize: 17,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 13,
    marginTop: 4,
    letterSpacing: 0.2,
  },
  content: {
    paddingHorizontal: 14,
    paddingBottom: 18,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255,255,255,0.35)',
    gap: 12,
  },
});
