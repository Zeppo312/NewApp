import React, { useEffect, useMemo, useState } from 'react';
import { ScrollView, View, Text, StyleSheet, Pressable } from 'react-native';
import { BlurView } from 'expo-blur';
import { LinearGradient } from 'expo-linear-gradient';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';

import { ThemedBackground } from '@/components/ThemedBackground';
import { useColorScheme } from '@/hooks/useColorScheme';
import { markPaywallShown } from '@/lib/paywall';

export default function PaywallScreen() {
  const { next, origin } = useLocalSearchParams<{ next?: string; origin?: string }>();
  const router = useRouter();
  const nextRoute = typeof next === 'string' && next.length > 0 ? next : '/(tabs)/home';
  const colorScheme = useColorScheme() ?? 'light';
  const [step, setStep] = useState(0);

  const slides = useMemo(
    () => [
      {
        id: 'trial',
        title: '14 Tage kostenlos testen – alles frei',
        subtitle: 'Schlaf, Planner, Shareables & Insights. Keine Limits.',
        body: (
          <BlurView intensity={30} tint="light" style={styles.heroCard}>
            <View style={styles.phoneMock}>
              <LinearGradient
                colors={['#F9F3EB', '#FFFFFF']}
                start={{ x: 0, y: 0 }}
                end={{ x: 0, y: 1 }}
                style={StyleSheet.absoluteFill}
              />
              <View style={styles.mockHeader}>
                <Text style={styles.mockTitle}>Lotti Tag</Text>
                <Text style={styles.mockSub}>Alles im Blick</Text>
              </View>
              <View style={styles.mockRow}>
                <Text style={styles.mockLabel}>Schlaf</Text>
                <Text style={styles.mockValue}>11h 30m</Text>
              </View>
              <View style={styles.mockRow}>
                <Text style={styles.mockLabel}>Mahlzeiten</Text>
                <Text style={styles.mockValue}>6x</Text>
              </View>
              <View style={[styles.mockRow, { marginTop: 10 }]}>
                <Text style={styles.mockLabel}>Nächster Schlaf</Text>
                <Text style={[styles.mockValue, { color: '#5E3DB3' }]}>in 40 Min</Text>
              </View>
            </View>
            <View style={styles.heroBubble}>
              <Text style={styles.heroBubbleText}>💜</Text>
            </View>
          </BlurView>
        ),
      },
      {
        id: 'reminder',
        title: 'Keine Sorge – wir erinnern dich 💛',
        subtitle: 'Bevor der Test endet, bekommst du einen Reminder. Kein Stress.',
        body: (
          <View style={styles.timelineCard}>
            <View style={styles.timelineRow}>
              <View style={styles.dot} />
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>Heute</Text>
                <Text style={styles.timelineDesc}>Alles sofort verfügbar</Text>
              </View>
            </View>
            <View style={styles.timelineRow}>
              <View style={styles.dot} />
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>In 12 Tagen</Text>
                <Text style={styles.timelineDesc}>Reminder, dass dein Trial endet</Text>
              </View>
            </View>
            <View style={styles.timelineRow}>
              <View style={styles.dot} />
              <View style={styles.timelineTextWrap}>
                <Text style={styles.timelineLabel}>In 14 Tagen</Text>
                <Text style={styles.timelineDesc}>Ab dann 1,99 € / Monat · jederzeit kündbar</Text>
              </View>
            </View>
          </View>
        ),
      },
      {
        id: 'price',
        title: 'Nach 14 Tagen: nur 1,99 € / Monat',
        subtitle: 'Keine Abofalle. Jederzeit kündbar.',
        body: (
          <BlurView intensity={20} tint="light" style={styles.featureCard}>
            <Text style={styles.featureTitle}>Das testest du kostenlos:</Text>
            <View style={styles.featurePill}><Text style={styles.featureText}>✨ Schlaftracker + individuelle Insights</Text></View>
            <View style={styles.featurePill}><Text style={styles.featureText}>🍽 Planner & Einkaufslisten</Text></View>
            <View style={styles.featurePill}><Text style={styles.featureText}>💜 Shareables & Meilensteine</Text></View>
            <View style={styles.featurePill}><Text style={styles.featureText}>📊 PDF-Exporte & Auswertungen</Text></View>
          </BlurView>
        ),
      },
    ],
    [],
  );

  useEffect(() => {
    // Anzeige registrieren, damit das 2h-Fenster in Supabase gesetzt ist
    markPaywallShown(origin);
  }, [origin]);

  const handleContinue = () => {
    if (step < slides.length - 1) {
      setStep(prev => Math.min(prev + 1, slides.length - 1));
    } else {
      router.replace(nextRoute);
    }
  };

  return (
    <ThemedBackground style={styles.shell}>
      <Stack.Screen options={{ headerShown: false }} />
      <LinearGradient
        colors={['#6C5ECF', '#5E3DB3', '#F5EEE0']}
        locations={[0, 0.4, 1]}
        start={{ x: 0, y: 0 }}
        end={{ x: 0, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={styles.topBar}>
          <View style={styles.badge}>
            <Text style={styles.badgeText}>Trial</Text>
          </View>
          <Text style={styles.logo}>Lotti Baby</Text>
        </View>

        <Text style={styles.headline}>{slides[step].title}</Text>
        <Text style={styles.subline}>{slides[step].subtitle}</Text>

        <View style={styles.hero}>{slides[step].body}</View>

        <View style={styles.stepDots}>
          {slides.map((s, idx) => (
            <View key={s.id} style={[styles.dotStep, idx === step && styles.dotStepActive]} />
          ))}
        </View>

        <View style={styles.ctaCard}>
          <Text style={styles.price}>14 Tage kostenlos · danach 1,99 € / Monat</Text>
          <Pressable style={styles.primaryButton} onPress={handleContinue}>
            <LinearGradient
              colors={['#FFD38D', '#FFB7A5']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <Text style={styles.primaryText}>
              Jetzt kostenlos starten
            </Text>
          </Pressable>
          <Text style={styles.legal}>
            Die Zahlung wird nach Ablauf der kostenlosen Testphase deinem iTunes-/App Store-Konto belastet.
            Das Abo verlängert sich automatisch, wenn es nicht mindestens 24 Stunden vor Ablauf in den Apple-ID Einstellungen gekündigt wird.
          </Text>
        </View>
      </ScrollView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  shell: {
    flex: 1,
  },
  container: {
    flexGrow: 1,
    padding: 24,
    paddingTop: 48,
    paddingBottom: 32,
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  badge: {
    backgroundColor: '#FFE7C8',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 18,
  },
  badgeText: {
    fontWeight: '700',
    color: '#7D5A50',
  },
  logo: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FDFBF6',
  },
  headline: {
    fontSize: 28,
    fontWeight: '800',
    color: '#FDFBF6',
    marginBottom: 8,
  },
  subline: {
    fontSize: 15,
    color: '#FDFBF6',
    opacity: 0.9,
    marginBottom: 20,
  },
  hero: {
    marginBottom: 22,
  },
  heroCard: {
    borderRadius: 28,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.25)',
    padding: 18,
    overflow: 'hidden',
  },
  phoneMock: {
    borderRadius: 18,
    overflow: 'hidden',
    backgroundColor: '#FFF',
    padding: 14,
    elevation: 4,
  },
  mockHeader: {
    marginBottom: 12,
  },
  mockTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#4A3A36',
  },
  mockSub: {
    fontSize: 12,
    color: '#8B7C72',
  },
  mockRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.05)',
  },
  mockLabel: {
    fontSize: 13,
    color: '#6A5952',
  },
  mockValue: {
    fontSize: 13,
    fontWeight: '700',
    color: '#2F1F1B',
  },
  heroBubble: {
    position: 'absolute',
    right: 16,
    top: 16,
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#FFB7A5',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FFB7A5',
    shadowOpacity: 0.4,
    shadowRadius: 10,
  },
  heroBubbleText: {
    fontSize: 22,
  },
  timelineCard: {
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderRadius: 22,
    padding: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
    marginBottom: 16,
  },
  timelineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 10,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#FFD38D',
    marginTop: 6,
    marginRight: 10,
  },
  timelineTextWrap: {
    flex: 1,
  },
  timelineLabel: {
    color: '#FDFBF6',
    fontWeight: '700',
    marginBottom: 2,
  },
  timelineDesc: {
    color: '#FDFBF6',
    opacity: 0.9,
    fontSize: 13,
  },
  featureCard: {
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.45)',
    backgroundColor: 'rgba(255,255,255,0.25)',
    padding: 16,
    marginBottom: 16,
  },
  featureTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: '#4A3A36',
    marginBottom: 10,
  },
  featurePill: {
    paddingVertical: 10,
    paddingHorizontal: 12,
    backgroundColor: '#F8EFE5',
    borderRadius: 14,
    marginBottom: 8,
  },
  featureText: {
    fontSize: 14,
    color: '#4A3A36',
    fontWeight: '600',
  },
  stepDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
    gap: 8,
  },
  dotStep: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(255,255,255,0.4)',
  },
  dotStepActive: {
    backgroundColor: '#FFD38D',
    width: 18,
  },
  ctaCard: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOpacity: 0.08,
    shadowRadius: 10,
  },
  price: {
    textAlign: 'center',
    fontWeight: '700',
    color: '#4A3A36',
    marginBottom: 12,
  },
  primaryButton: {
    backgroundColor: '#5E3DB3',
    paddingVertical: 14,
    borderRadius: 18,
    alignItems: 'center',
    marginBottom: 10,
    overflow: 'hidden',
  },
  primaryText: {
    color: '#2F1F1B',
    fontSize: 16,
    fontWeight: '800',
  },
  legal: {
    fontSize: 11,
    opacity: 0.7,
    lineHeight: 15,
    color: '#4A3A36',
    textAlign: 'center',
  },
});
