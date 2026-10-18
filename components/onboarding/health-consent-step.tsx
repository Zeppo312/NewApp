import React from 'react';
import { Linking, Pressable, StyleSheet, Text, View } from 'react-native';
import type { OnboardingLocale } from '@/lib/onboardingTranslations';
import { activeDataConsentCopy } from '@/lib/dataConsentCopy';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { OnboardingChoice, OnboardingSurface } from './surfaces';
import { onboardingColors as brand } from './theme';
import { valueStyles } from './value-steps';
import { LottiMedallion } from './lotti-medallion';

type Copy = { title: string; body: string; granted: string; withdrawal: string; cta: string; declineTitle: string; declineBody: string; back: string };
const copy: Record<OnboardingLocale, Copy> = {
  de: {
    title: 'Bevor es um dein Baby geht',
    body: 'Gleich fragen wir nach Schwangerschaft oder Geburt. Das sind Gesundheitsdaten, deshalb brauchen wir dafür deine ausdrückliche Zustimmung.',
    granted: 'Du hast der Verarbeitung deiner Gesundheitsdaten zugestimmt.',
    withdrawal: 'Freiwillig. Du kannst die Einwilligung jederzeit in den Einstellungen unter „Einwilligungen“ widerrufen. Über die KI-Funktionen entscheidest du erst, wenn du sie nutzt.',
    cta: 'Zustimmen und weiter',
    declineTitle: 'Ohne Zustimmung geht es nicht weiter',
    declineBody: 'Lotti hält Schwangerschaft und Baby-Alltag fest. Ohne deine Zustimmung können wir diese Daten nicht verarbeiten. Du kannst jederzeit zurückkommen und zustimmen.',
    back: 'Zurück',
  },
  en: {
    title: 'Before we talk about your baby',
    body: 'Next we ask about pregnancy or birth. This is health data, so we need your explicit consent first.',
    granted: 'You consented to the processing of your health data.',
    withdrawal: 'Voluntary. You can withdraw consent at any time in Settings under “Consents”. You decide about AI features only when you use them.',
    cta: 'Agree and continue',
    declineTitle: 'We can’t continue without consent',
    declineBody: 'Lotti records pregnancy and everyday baby life. Without your consent we cannot process this data. You can come back and agree at any time.',
    back: 'Back',
  },
  es: {
    title: 'Antes de hablar de tu bebé',
    body: 'A continuación te preguntamos por el embarazo o el nacimiento. Son datos de salud, por eso necesitamos antes tu consentimiento expreso.',
    granted: 'Has consentido el tratamiento de tus datos de salud.',
    withdrawal: 'Voluntario. Puedes retirar el consentimiento en cualquier momento en Ajustes, en «Consentimientos». Sobre las funciones de IA decides solo cuando las uses.',
    cta: 'Aceptar y continuar',
    declineTitle: 'Sin consentimiento no podemos continuar',
    declineBody: 'Lotti registra el embarazo y el día a día con tu bebé. Sin tu consentimiento no podemos tratar estos datos. Puedes volver y aceptar en cualquier momento.',
    back: 'Volver',
  },
};
export const healthConsentCopy = (locale: OnboardingLocale) => copy[locale];

/** Onboarding step for the explicit health consent (Art. 9 GDPR), asked right before the first health question. */
export function HealthConsentStep({ locale, checked, granted, error, busy, onToggle, onDecline }: {
  locale: OnboardingLocale; checked: boolean; granted: boolean; error: boolean; busy: boolean;
  onToggle: () => void; onDecline: () => void;
}) {
  const c = copy[locale];
  const legal = activeDataConsentCopy[locale];
  return <View style={s.screen}>
    <Text accessibilityRole="header" style={s.title}>{c.title}</Text>
    <Text style={s.body}>{c.body}</Text>
    <View style={s.center}>
      <LottiMedallion pose="heart" float />
      <OnboardingSurface style={s.card}>
        <View style={s.row}>
          <View style={s.icon}><IconSymbol name="heart.fill" size={20} color="#D46A93" /></View>
          <Text style={s.cardTitle}>{legal.healthTitle}</Text>
        </View>
        <Text style={s.cardBody}>{legal.healthBody}</Text>
        <Pressable accessibilityRole="link" onPress={() => void Linking.openURL(`https://lottibaby.de/datenschutz?lang=${locale}`)} style={s.link}>
          <Text style={s.linkText}>{legal.privacy}</Text>
          <IconSymbol name="arrow.up.right" size={14} color={brand.accentText} />
        </Pressable>
      </OnboardingSurface>
      {granted ? (
        <OnboardingSurface style={[s.card, s.row]}>
          <IconSymbol name="checkmark.circle.fill" size={24} color={brand.accentText} />
          <Text style={[s.choiceText, { flex: 1 }]}>{c.granted}</Text>
        </OnboardingSurface>
      ) : (
        <OnboardingChoice selected={checked} disabled={busy} onPress={onToggle} accessibilityRole="checkbox"
          accessibilityState={{ checked, disabled: busy }} contentStyle={s.choice}>
          <View accessible={false} style={[s.box, checked && s.boxChecked]}>
            {checked && <IconSymbol name="checkmark" size={16} color={brand.white} />}
          </View>
          <Text style={s.choiceText}>{legal.healthChoice}</Text>
        </OnboardingChoice>
      )}
      {error && <Text accessibilityRole="alert" style={s.error}>{legal.error}</Text>}
      <Text style={s.small}>{c.withdrawal}</Text>
      {!granted && <Pressable accessibilityRole="button" disabled={busy} onPress={onDecline} style={s.decline}>
        <Text style={s.linkText}>{legal.declineHealth}</Text>
      </Pressable>}
    </View>
  </View>;
}
const s = StyleSheet.create({
  ...valueStyles,
  center: { flexGrow: 1, flexShrink: 0, justifyContent: 'center', gap: 18, paddingVertical: 16 },
  card: { padding: 20, gap: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  icon: { width: 40, height: 40, borderRadius: 20, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(232,160,191,0.22)' },
  cardTitle: { flex: 1, fontSize: 19, lineHeight: 25, fontWeight: '700', color: brand.text },
  cardBody: { fontSize: 15, lineHeight: 23, color: brand.text },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start', minHeight: 44 },
  linkText: { fontSize: 15, lineHeight: 21, fontWeight: '600', color: brand.accentText },
  choice: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, padding: 18 },
  box: { width: 26, height: 26, borderRadius: 8, borderWidth: 2, borderColor: brand.accent, backgroundColor: brand.white, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  boxChecked: { backgroundColor: brand.accent },
  choiceText: { flex: 1, fontSize: 15, lineHeight: 22, fontWeight: '600', color: brand.text },
  error: { fontSize: 15, lineHeight: 22, color: '#9b2531' },
  small: { fontSize: 13, lineHeight: 20, color: brand.secondary },
  decline: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
