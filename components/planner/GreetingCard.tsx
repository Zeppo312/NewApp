import React from 'react';
import { View, StyleSheet } from 'react-native';
import { ThemedText } from '@/components/ThemedText';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import { GLASS_BORDER, GLASS_OVERLAY, LAYOUT_PAD, PRIMARY, TEXT_PRIMARY } from '@/constants/PlannerDesign';

type Props = {
  name?: string;
};

export const GreetingCard: React.FC<Props> = ({ name = 'Lotti' }) => {
  return (
    <LiquidGlassCard
      style={styles.card}
      overlayColor={GLASS_OVERLAY}
      borderColor={GLASS_BORDER}
      intensity={24}
    >
      <View style={styles.row} accessible accessibilityRole="summary" accessibilityLabel={`Begrüßung. Guten Morgen, ${name}.`}>
        <ThemedText style={styles.emoji} accessibilityLabel="Sonnenschein Emoji">☀️</ThemedText>
        <View style={{ flex: 1 }}>
          <ThemedText style={styles.headline}>{`Guten Morgen, ${name} `}<ThemedText style={{ color: PRIMARY }}>💜</ThemedText></ThemedText>
          <ThemedText style={styles.sub} lightColor={TEXT_PRIMARY} darkColor={TEXT_PRIMARY}>
            Schön, dass du da bist.
          </ThemedText>
        </View>
      </View>
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    padding: LAYOUT_PAD,
    borderRadius: 26,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  row: { flexDirection: 'row', alignItems: 'center' },
  emoji: { fontSize: 32, marginRight: 12 },
  headline: {
    fontSize: 20,
    fontWeight: '700',
  },
  sub: {
    marginTop: 4,
    fontSize: 14,
    opacity: 0.9,
    color: TEXT_PRIMARY,
  },
});

export default GreetingCard;
