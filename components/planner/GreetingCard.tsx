import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import { GLASS_BORDER, GLASS_OVERLAY, LAYOUT_PAD, PRIMARY, TEXT_PRIMARY } from '@/constants/PlannerDesign';

type Props = {
  title: string;
  subline?: string;
  emoji?: string;
};

export const GreetingCard: React.FC<Props> = ({
  title,
  subline = 'Schön, dass du da bist.',
  emoji = '☀️',
}) => {
  return (
    <LiquidGlassCard
      style={styles.card}
      overlayColor={GLASS_OVERLAY}
      borderColor={GLASS_BORDER}
      intensity={24}
    >
      <View
        style={styles.row}
        accessible
        accessibilityRole="summary"
        accessibilityLabel={`Begrüßung. ${title}.`}
      >
        <ThemedText style={styles.emoji} accessibilityLabel="Stimmungs-Emoji">{emoji}</ThemedText>
        <View style={styles.textWrap}>
          <ThemedText style={styles.headline}>
            {title}{' '}
            <ThemedText style={styles.highlight}>💜</ThemedText>
          </ThemedText>
          {subline ? (
            <ThemedText style={styles.sub} lightColor={TEXT_PRIMARY} darkColor={TEXT_PRIMARY}>
              {subline}
            </ThemedText>
          ) : null}
        </View>
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    paddingHorizontal: LAYOUT_PAD,
    paddingVertical: LAYOUT_PAD + 8,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 36, marginRight: 12 },
  textWrap: { flex: 1 },
  headline: {
    fontSize: 21,
    fontWeight: '700',
    lineHeight: 26,
  },
  highlight: { color: PRIMARY },
  sub: {
    marginTop: 4,
    fontSize: 15,
    opacity: 0.85,
    color: TEXT_PRIMARY,
    lineHeight: 20,
  },
});

export default GreetingCard;
