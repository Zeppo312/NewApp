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
  const copy = LOCKED_FEATURE_COPY[feature];
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
                {isPremiumFeature ? 'Premium-Feature' : 'Nicht in Lotti Lite'}
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
                  ? 'Mit Premium freischalten'
                  : 'Abo-Optionen ansehen'}
              </Text>
            </Pressable>
            <Pressable onPress={() => router.back()} hitSlop={8}>
              <Text style={styles.backText}>Vielleicht später</Text>
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
