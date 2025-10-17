import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import { Mood } from '@/services/planner';
import { ThemedText } from '@/components/ThemedText';
import { GLASS_BORDER, GLASS_OVERLAY, LAYOUT_PAD, PRIMARY } from '@/constants/PlannerDesign';

type Props = {
  mood?: Mood;
  reflection?: string;
  onChangeMood: (mood: Mood) => void;
  onChangeReflection: (text: string) => void;
};

const moods: { key: Mood; label: string; emoji: string }[] = [
  { key: 'great', label: 'Super', emoji: '🌟' },
  { key: 'good', label: 'Gut', emoji: '🙂' },
  { key: 'okay', label: 'Okay', emoji: '😐' },
  { key: 'bad', label: 'Schwer', emoji: '🌧️' },
];

export const EveningReflectionCard: React.FC<Props> = ({ mood, reflection, onChangeMood, onChangeReflection }) => {
  return (
    <LiquidGlassCard style={styles.card} overlayColor={GLASS_OVERLAY} borderColor={GLASS_BORDER} intensity={24}>
      <ThemedText style={styles.title}>Abend-Reflexion</ThemedText>
      <View style={styles.moodRow} accessible accessibilityRole="radiogroup" accessibilityLabel="Stimmung auswählen">
        {moods.map((m) => {
          const active = mood === m.key;
          return (
            <Pressable
              key={m.key}
              onPress={() => onChangeMood(m.key)}
              style={[styles.moodBtn, active && styles.moodBtnActive]}
              accessibilityRole="radio"
              accessibilityState={{ selected: active }}
              accessibilityLabel={`${m.label}`}
            >
              <ThemedText style={styles.moodEmoji}>{m.emoji}</ThemedText>
              <ThemedText style={[styles.moodLabel, active && { color: '#fff' }]}>{m.label}</ThemedText>
            </Pressable>
          );
        })}
      </View>
      <TextInput
        value={reflection}
        onChangeText={onChangeReflection}
        placeholder="Was lief heute gut?"
        placeholderTextColor={'rgba(0,0,0,0.35)'}
        accessibilityLabel="Reflexionsnotiz"
        style={styles.input}
        multiline
      />
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    borderRadius: 26,
    padding: LAYOUT_PAD,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: 12 },
  moodRow: { flexDirection: 'row', justifyContent: 'space-between', gap: 10, marginBottom: 12 },
  moodBtn: {
    flex: 1,
    minHeight: 64,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    backgroundColor: 'rgba(255,255,255,0.3)',
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
  },
  moodBtnActive: { backgroundColor: PRIMARY, borderColor: PRIMARY },
  moodEmoji: { fontSize: 20, marginBottom: 4 },
  moodLabel: { fontWeight: '600', color: PRIMARY },
  input: {
    minHeight: 40,
    borderRadius: 14,
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
});

export default EveningReflectionCard;
