/**
 * Vollbild-Sperre für Features, die im aktuellen Abo-Tier nicht enthalten
 * sind. Zeigt Benefit-Copy aus LOCKED_FEATURE_COPY und führt zur Paywall
 * (mit origin-Parameter, damit sich später messen lässt, welcher Lock
 * konvertiert).
 */

import React from 'react';
import {
  Pressable,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';

import Header from '@/components/Header';
import { ThemedBackground } from '@/components/ThemedBackground';
import { ThemedText } from '@/components/ThemedText';
import { GlassCard } from '@/components/ui/GlassCard';
import {
  LOCKED_FEATURE_COPY,
  type AppFeature,
} from '@/lib/entitlements';
import { useLocale } from '@/contexts/LocaleContext';

type LockedFeatureScreenProps = {
  feature: AppFeature;
  /** Header-Titel; Standard ist der Feature-Titel aus der Copy. */
  headerTitle?: string;
  headerSubtitle?: string;
};

export function LockedFeatureScreen({
  feature,
  headerTitle,
  headerSubtitle,
}: LockedFeatureScreenProps) {
  const router = useRouter();
  const { locale } = useLocale();
  const defaultCopy = LOCKED_FEATURE_COPY[feature];
  const translated = {
    en: {
      partnerLink: { title: 'Together as a family', subtitle: 'Link your account with your partner so you can both see and track the same baby.', bullets: ['Entries appear for both of you immediately', 'Both of you can see the current status', 'Notifications for your partner'] },
      planner: { title: 'Planner & appointments', subtitle: 'Keep medical appointments, check-ups, and family life in view.', bullets: ['Shared family calendar', 'Reminders for important appointments', 'Synced with your partner'] },
      shoppingList: { title: 'Shopping lists', subtitle: 'Running low on diapers? Add it once and both of you can see it.', bullets: ['Shared lists for both of you', 'Low-stock reminders', 'Templates for baby essentials'] },
      wochenmomente: { title: 'Weekly moments', subtitle: "Save one special moment from your baby's week.", bullets: ['A weekly memory collection', 'Your story to look back on', 'Share moments with your partner'] },
    },
    es: {
      partnerLink: { title: 'Juntos en familia', subtitle: 'Vincula tu cuenta con la de tu pareja para ver y registrar al mismo bebé.', bullets: ['Los registros aparecen al instante para ambos', 'Los dos veis la situación actual', 'Notificaciones para tu pareja'] },
      planner: { title: 'Planificador y citas', subtitle: 'Ten a la vista las citas médicas, revisiones y la vida familiar.', bullets: ['Calendario familiar compartido', 'Recordatorios de citas importantes', 'Sincronizado con tu pareja'] },
      shoppingList: { title: 'Listas de la compra', subtitle: '¿Quedan pocos pañales? Añádelo una vez y ambos lo veréis.', bullets: ['Listas compartidas', 'Recordatorios cuando queden pocas unidades', 'Plantillas de productos esenciales'] },
      wochenmomente: { title: 'Momentos semanales', subtitle: 'Guarda cada semana un momento especial de tu bebé.', bullets: ['Colección semanal de recuerdos', 'Vuestra historia para volver a verla', 'Comparte momentos con tu pareja'] },
    },
  } as const;
  const localizedCopy = locale === 'de' ? null : translated[locale][feature as keyof typeof translated.en];
  const copy = localizedCopy ? { ...defaultCopy, ...localizedCopy } : defaultCopy;
  const ui = {
    de: { premium: 'Premium-Feature', lite: 'Nicht in Lotti Lite', unlock: 'Mit Premium freischalten', options: 'Abo-Optionen ansehen', later: 'Vielleicht später' },
    en: { premium: 'Premium feature', lite: 'Not in Lotti Lite', unlock: 'Unlock with Premium', options: 'View subscription options', later: 'Maybe later' },
    es: { premium: 'Función Premium', lite: 'No incluido en Lotti Lite', unlock: 'Desbloquear con Premium', options: 'Ver opciones de suscripción', later: 'Quizá más tarde' },
  }[locale];
  const isPremiumFeature = copy.requiredTier === 'premium';

  const openPaywall = () => {
    router.push(`/paywall?origin=lock_${feature}` as any);
  };

  return (
    <ThemedBackground style={styles.background}>
      <SafeAreaView style={styles.safeArea}>
        <StatusBar barStyle="dark-content" />
        <Header
          title={headerTitle ?? copy.title}
          subtitle={headerSubtitle}
          showBackButton
          showBabySwitcher={false}
        />
        <View style={styles.wrap}>
          <GlassCard radius={22} contentStyle={styles.content}>
            <Text style={styles.emoji}>{isPremiumFeature ? '✨' : '🔒'}</Text>
            <View
              style={[
                styles.tierBadge,
                isPremiumFeature && styles.tierBadgePremium,
              ]}
            >
              <Text
                style={[
                  styles.tierBadgeText,
                  isPremiumFeature && styles.tierBadgeTextPremium,
                ]}
              >
                {isPremiumFeature ? ui.premium : ui.lite}
              </Text>
            </View>
            <ThemedText adaptive={false} style={styles.title}>
              {copy.title}
            </ThemedText>
            <ThemedText adaptive={false} style={styles.subtitle}>
              {copy.subtitle}
            </ThemedText>

            {copy.bullets.length > 0 ? (
              <View style={styles.bullets}>
                {copy.bullets.map((item) => (
                  <View key={item} style={styles.bulletRow}>
                    <View
                      style={[
                        styles.bulletDot,
                        isPremiumFeature && styles.bulletDotPremium,
                      ]}
                    />
                    <ThemedText adaptive={false} style={styles.bulletText}>
                      {item}
                    </ThemedText>
                  </View>
                ))}
              </View>
            ) : null}

            <Pressable onPress={openPaywall} style={styles.ctaButton}>
              <LinearGradient
                colors={['#FFCFAE', '#FEB493']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <Text style={styles.ctaButtonText}>
                {isPremiumFeature
                  ? ui.unlock
                  : ui.options}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.backText}>{ui.later}</Text>
            </Pressable>
          </GlassCard>
        </View>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  wrap: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 24,
  },
  content: {
    alignItems: 'center',
    paddingVertical: 28,
    paddingHorizontal: 22,
    gap: 10,
  },
  emoji: {
    fontSize: 40,
  },
  tierBadge: {
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 999,
    backgroundColor: 'rgba(94,61,179,0.12)',
  },
  tierBadgePremium: {
    backgroundColor: 'rgba(240,164,96,0.18)',
  },
  tierBadgeText: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.6,
    textTransform: 'uppercase',
    color: '#5E3DB3',
  },
  tierBadgeTextPremium: {
    color: '#B06B1E',
  },
  title: {
    marginTop: 4,
    fontSize: 22,
    lineHeight: 28,
    fontWeight: '800',
    color: '#4A3A33',
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 15,
    lineHeight: 22,
    color: '#7D5A50',
    textAlign: 'center',
  },
  bullets: {
    marginTop: 8,
    alignSelf: 'stretch',
    gap: 8,
  },
  bulletRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  bulletDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#8E4EC6',
  },
  bulletDotPremium: {
    backgroundColor: '#F0A460',
  },
  bulletText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
    color: '#5F4346',
  },
  ctaButton: {
    marginTop: 14,
    alignSelf: 'stretch',
    height: 52,
    borderRadius: 16,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ctaButtonText: {
    fontSize: 15,
    fontWeight: '800',
    color: '#5A322B',
  },
  backText: {
    marginTop: 10,
    fontSize: 14,
    fontWeight: '700',
    color: '#8C6459',
  },
});

export default LockedFeatureScreen;
