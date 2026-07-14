import { PropsWithChildren, useState } from 'react';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { LiquidGlassCard, TEXT_PRIMARY } from '@/constants/DesignGuide';
import { useColorScheme } from '@/hooks/useColorScheme';

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
  const theme = useColorScheme() ?? 'light';
  const iconColor = theme === 'dark' ? Colors.dark.text : TEXT_PRIMARY;

  return (
    <LiquidGlassCard style={styles.card}>
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
            <ThemedText style={styles.title} lightColor={TEXT_PRIMARY}>
              {title}
            </ThemedText>
            {subtitle && (
              <ThemedText style={styles.subtitle} lightColor="rgba(125,90,80,0.75)">
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
          <View style={styles.content}>
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
