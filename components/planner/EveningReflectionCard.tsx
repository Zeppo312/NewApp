import React from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { LiquidGlassCard } from '@/constants/DesignGuide';
import { Mood } from '@/services/planner';
import { ThemedText } from '@/components/ThemedText';
import { GLASS_BORDER, GLASS_OVERLAY, LAYOUT_PAD, PRIMARY } from '@/constants/PlannerDesign';
import { useLocale } from '@/contexts/LocaleContext';

type Props = {
  mood?: Mood;
  reflection?: string;
  onChangeMood: (mood: Mood) => void;
  onChangeReflection: (text: string) => void;
};

export const EveningReflectionCard: React.FC<Props> = ({ mood, reflection, onChangeMood, onChangeReflection }) => {
  const { locale } = useLocale();
  const c = {
    de: { title: 'Abend-Reflexion', choose: 'Stimmung auswählen', placeholder: 'Was lief heute gut?', note: 'Reflexionsnotiz', moods: ['Super', 'Gut', 'Okay', 'Schwer'] },
    en: { title: 'Evening reflection', choose: 'Choose a mood', placeholder: 'What went well today?', note: 'Reflection note', moods: ['Great', 'Good', 'Okay', 'Hard'] },
    es: { title: 'Reflexión de la tarde', choose: 'Elegir estado de ánimo', placeholder: '¿Qué ha ido bien hoy?', note: 'Nota de reflexión', moods: ['Genial', 'Bien', 'Regular', 'Difícil'] },
  }[locale];
  const moods: { key: Mood; label: string; emoji: string }[] = [
    { key: 'great', label: c.moods[0], emoji: '🌟' }, { key: 'good', label: c.moods[1], emoji: '🙂' }, { key: 'okay', label: c.moods[2], emoji: '😐' }, { key: 'bad', label: c.moods[3], emoji: '🌧️' },
  ];
  return (
    <LiquidGlassCard style={styles.card} overlayColor={GLASS_OVERLAY} borderColor={GLASS_BORDER} intensity={24}>
      <ThemedText style={styles.title}>{c.title}</ThemedText>
      <View style={styles.moodRow} accessible accessibilityRole="radiogroup" accessibilityLabel={c.choose}>
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
        placeholder={c.placeholder}
        placeholderTextColor={'rgba(0,0,0,0.35)'}
        accessibilityLabel={c.note}
        style={styles.input}
        multiline
      />
    </LiquidGlassCard>
  );
};

const styles = StyleSheet.create({
  card: {
    alignSelf: 'stretch',
    borderRadius: 28,
    padding: LAYOUT_PAD,
    paddingHorizontal: LAYOUT_PAD + 8,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
  },
  title: { fontSize: 18, fontWeight: '700', marginBottom: 16, textAlign: 'center' },
  moodRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 14,
    marginBottom: 16,
    flexWrap: 'wrap',
  },
  moodBtn: {
    minWidth: 78,
    paddingHorizontal: 12,
    paddingVertical: 14,
    borderRadius: 20,
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
  moodEmoji: { fontSize: 22, marginBottom: 4 },
  moodLabel: { fontWeight: '600', color: PRIMARY, textAlign: 'center' },
  input: {
    minHeight: 88,
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 14,
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
    textAlignVertical: 'top',
  },
});

export default EveningReflectionCard;
