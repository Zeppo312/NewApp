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
    alignSelf: 'stretch',
    width: '100%',
    paddingHorizontal: LAYOUT_PAD,
    paddingVertical: LAYOUT_PAD + 24,
    borderRadius: 32,
    minHeight: 200,
    marginHorizontal: 0,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 48, marginRight: 18 },
  textWrap: { flex: 1, alignItems: 'center' },
  headline: {
    fontSize: 24,
    fontWeight: '700',
    lineHeight: 32,
    textAlign: 'center',
  },
  highlight: { color: PRIMARY },
  sub: {
    marginTop: 8,
    fontSize: 16,
    opacity: 0.85,
    color: TEXT_PRIMARY,
    lineHeight: 22,
    textAlign: 'center',
  },
});

export default GreetingCard;
