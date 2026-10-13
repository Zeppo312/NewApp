import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Slider from '@react-native-community/slider';
import type { OnboardingLocale } from '@/lib/onboardingTranslations';
import type { OnboardingWellbeing } from '@/lib/onboarding-personalization';
import { OnboardingSurface } from './surfaces';
import { onboardingColors as brand } from './theme';
import { valueStyles } from './value-steps';

type Copy = { moodTitle: string; energyTitle: string; moodBody: string; energyBody: string; optional: string; choose: string; mood: string[]; energy: string[]; lowMood: string; highMood: string; lowEnergy: string; highEnergy: string; reset: string; summaryTitle: string; summary: string; gentleSummary: string; skip: string };
const copy: Record<OnboardingLocale, Copy> = {
  de: {
    moodTitle: 'Und wie geht es dir gerade?', energyTitle: 'Wie viel Energie hast du heute?',
    moodBody: 'Zwischen all den Gedanken an dein Baby darf auch Platz für dich sein.', energyBody: 'Manche Tage brauchen kleine Schritte. Was passt heute zu dir?',
    optional: 'Freiwillig · Nur eine Momentaufnahme, keine Bewertung.', choose: 'Bewege den Regler oder tippe auf ein Gefühl.',
    mood: ['Sehr schwer', 'Eher schwer', 'Gemischt', 'Ganz gut', 'Richtig gut'], energy: ['Erschöpft', 'Wenig Kraft', 'Ein bisschen', 'Gut dabei', 'Voller Energie'],
    lowMood: 'Danke, dass du das teilst. Du musst gerade nicht alles im Griff haben.', highMood: 'Schön, dass du kurz bei dir eingecheckt hast. Jedes Gefühl darf da sein.',
    lowEnergy: 'Für heute darf ein kleiner Schritt genug sein. Pausen zählen auch.', highEnergy: 'Du bestimmst dein Tempo. Es muss nicht jeden Tag gleich sein.', reset: 'Antwort zurücksetzen',
    summaryTitle: 'Auch du zählst', summary: 'Im Bereich „Für dich“ kannst du deine Stimmung festhalten und dir Zeit für dich nehmen.', gentleSummary: 'Ein kleiner Einstieg reicht. Im Bereich „Für dich“ ist auch Platz für deine Stimmung und persönliche Pausen.', skip: 'Überspringen',
  },
  en: {
    moodTitle: 'And how are you feeling?', energyTitle: 'How much energy do you have today?', moodBody: 'With so much on your mind about your baby, there is room for you too.', energyBody: 'Some days call for small steps. What feels right today?',
    optional: 'Optional · A moment in time, not a judgement.', choose: 'Move the slider or tap a feeling.', mood: ['Very difficult', 'Difficult', 'Mixed', 'Pretty good', 'Really good'], energy: ['Exhausted', 'Low energy', 'A little', 'Doing well', 'Full of energy'],
    lowMood: 'Thank you for sharing. You do not have to have everything figured out.', highMood: 'Thank you for checking in with yourself. Every feeling has a place.', lowEnergy: 'One small step can be enough today. Rest counts too.', highEnergy: 'You set the pace. It does not have to be the same every day.', reset: 'Clear answer', summaryTitle: 'You matter too', summary: 'In “For you”, you can record your mood and make time for yourself.', gentleSummary: 'A small start is enough. “For you” has space for your mood and personal breaks too.', skip: 'Skip',
  },
  es: {
    moodTitle: '¿Y cómo te sientes tú?', energyTitle: '¿Cuánta energía tienes hoy?', moodBody: 'Entre tantos pensamientos sobre tu bebé, también hay espacio para ti.', energyBody: 'Hay días para dar pasos pequeños. ¿Cómo te sientes hoy?',
    optional: 'Opcional · Solo refleja este momento, sin juzgar.', choose: 'Mueve el control o toca una emoción.', mood: ['Muy mal', 'Algo mal', 'Regular', 'Bastante bien', 'Muy bien'], energy: ['Sin fuerzas', 'Poca energía', 'Un poco', 'Con energía', 'A tope'],
    lowMood: 'Gracias por compartirlo. No necesitas tenerlo todo bajo control.', highMood: 'Gracias por dedicarte este momento. Todas las emociones tienen su lugar.', lowEnergy: 'Hoy puede bastar con un pequeño paso. Descansar también cuenta.', highEnergy: 'Tú marcas el ritmo. No tiene que ser igual todos los días.', reset: 'Borrar respuesta', summaryTitle: 'Tú también importas', summary: 'En «Para ti» puedes registrar tu ánimo y dedicarte tiempo.', gentleSummary: 'Basta con empezar poco a poco. En «Para ti» también hay espacio para tu ánimo y tus pausas.', skip: 'Omitir',
  },
};
export const wellbeingCopy = (locale: OnboardingLocale) => copy[locale];
export function wellbeingSummary(locale: OnboardingLocale, answers: OnboardingWellbeing) {
  return (answers.mood !== null && answers.mood <= 2) || (answers.energy !== null && answers.energy <= 2) ? copy[locale].gentleSummary : copy[locale].summary;
}
export function WellbeingStep({ locale, kind, value, onChange }: { locale: OnboardingLocale; kind: 'mood' | 'energy'; value: number | null; onChange: (value: number | null) => void }) {
  const c = copy[locale];
  const labels = c[kind];
  const emoji = kind === 'mood' ? ['😢', '😔', '😐', '🙂', '😃'] : ['🪫', '🌱', '🌤️', '☀️', '✨'];
  return <View style={s.screen}>
    <Text accessibilityRole="header" style={s.title}>{c[`${kind}Title`]}</Text>
    <Text style={s.body}>{c[`${kind}Body`]}</Text>
    <View style={s.center}>
      <Text accessible={false} style={s.emoji}>{value === null ? kind === 'mood' ? '🤍' : '🌿' : emoji[value - 1]}</Text>
      <Text accessibilityLiveRegion="polite" style={s.selection}>{value === null ? c.choose : labels[value - 1]}</Text>
      <Slider accessibilityRole="adjustable" testID="wellbeing-slider" accessibilityLabel={c[`${kind}Title`]} accessibilityValue={{ min: 1, max: 5, now: value ?? 3, text: value === null ? c.choose : labels[value - 1] }} minimumValue={1} maximumValue={5} step={1} value={value ?? 3} onValueChange={onChange} tapToSeek minimumTrackTintColor={value === null ? '#CBB5D7' : brand.accent} maximumTrackTintColor="#E4D8EA" thumbTintColor={brand.accent} style={s.slider} />
      <View style={s.scale}>{labels.map((label, index) => <Pressable key={label} accessibilityRole="radio" accessibilityLabel={label} accessibilityState={{ checked: value === index + 1 }} onPress={() => onChange(index + 1)} style={[s.tick, value === index + 1 && s.selected]}><Text accessible={false} style={s.smallEmoji}>{emoji[index]}</Text><Text style={s.tickLabel}>{label}</Text></Pressable>)}</View>
      {value !== null && <OnboardingSurface style={s.response}><Text accessibilityLiveRegion="polite" style={s.responseText}>{c[kind === 'mood' ? value <= 2 ? 'lowMood' : 'highMood' : value <= 2 ? 'lowEnergy' : 'highEnergy']}</Text></OnboardingSurface>}
      <Text style={s.optional}>{c.optional}</Text>
      {value !== null && <Pressable accessibilityRole="button" onPress={() => onChange(null)} style={s.reset}><Text style={s.resetText}>{c.reset}</Text></Pressable>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  ...valueStyles, center: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', gap: 22, paddingVertical: 24 },
  emoji: { fontSize: 68, textAlign: 'center' }, selection: { fontSize: 23, lineHeight: 30, fontWeight: '600', color: brand.text, textAlign: 'center', minHeight: 60 },
  slider: { width: '100%', height: 44 }, scale: { flexDirection: 'row', gap: 3, alignItems: 'stretch' }, tick: { flex: 1, paddingVertical: 9, paddingHorizontal: 2, borderRadius: 16, gap: 8, minHeight: 76, borderWidth: 1, borderColor: 'transparent' }, selected: { backgroundColor: brand.selectedGlass, borderColor: brand.accent }, smallEmoji: { fontSize: 25, textAlign: 'center' }, tickLabel: { fontSize: 11, lineHeight: 16, textAlign: 'center', color: brand.text },
  response: { padding: 18 }, responseText: { fontSize: 16, lineHeight: 24, color: brand.text, textAlign: 'center' }, optional: { fontSize: 12, lineHeight: 19, color: brand.secondary, textAlign: 'center' }, reset: { minHeight: 44, justifyContent: 'center', alignItems: 'center' }, resetText: { fontSize: 13, color: brand.accentText },
});
