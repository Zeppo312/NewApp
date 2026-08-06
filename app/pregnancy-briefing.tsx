import React, { useCallback, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { Stack, useFocusEffect, useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { LockedFeatureScreen } from '@/components/LockedFeatureScreen';
import PregnancyBriefingCard from '@/components/pregnancy-briefing-card';
import { ThemedBackground } from '@/components/ThemedBackground';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { Colors } from '@/constants/Colors';
import { useAuth } from '@/contexts/AuthContext';
import { useLocale } from '@/contexts/LocaleContext';
import { useAdaptiveColors } from '@/hooks/useAdaptiveColors';
import { useFeatureAccess } from '@/lib/entitlements';
import {
  buildPregnancyBriefing,
  EMPTY_PREGNANCY_BRIEFING_SIGNALS,
  type PregnancyBriefingItem,
  type PregnancyBriefingSignals,
} from '@/lib/pregnancy-briefing';
import { loadPregnancyBriefingSignals } from '@/lib/pregnancy-briefing-data';
import { translatePregnancyBriefingText } from '@/lib/pregnancy-briefing-translations';
import {
  invalidatePregnancyCache,
  loadPregnancyHomeDataWithCache,
} from '@/lib/pregnancyCache';

const cloneEmptySignals = (): PregnancyBriefingSignals => ({
  ...EMPTY_PREGNANCY_BRIEFING_SIGNALS,
  checklist: { ...EMPTY_PREGNANCY_BRIEFING_SIGNALS.checklist },
});

export default function PregnancyBriefingScreen() {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translatePregnancyBriefingText>[1]) =>
    translatePregnancyBriefingText(locale, key);
  const router = useRouter();
  const { user } = useAuth();
  const userId = user?.id;
  const access = useFeatureAccess('pregnancyBriefing');
  const adaptiveColors = useAdaptiveColors();
  const isDark = adaptiveColors.effectiveScheme === 'dark' || adaptiveColors.isDarkBackground;
  const textPrimary = isDark ? Colors.dark.textPrimary : '#5C4033';
  const requestVersion = useRef(0);

  const [currentWeek, setCurrentWeek] = useState<number | null>(null);
  const [currentDay, setCurrentDay] = useState<number | null>(null);
  const [signals, setSignals] = useState<PregnancyBriefingSignals>(cloneEmptySignals);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [hasLoadedOnce, setHasLoadedOnce] = useState(false);

  const briefing = useMemo(
    () => buildPregnancyBriefing({
      locale,
      currentWeek,
      currentDay,
      signals,
    }),
    [currentDay, currentWeek, locale, signals],
  );

  const loadBriefing = useCallback(async (forceRefresh = false) => {
    if (!userId || access.hasAccess !== true) {
      setIsLoading(false);
      setIsRefreshing(false);
      return;
    }

    const currentRequest = ++requestVersion.current;
    if (forceRefresh) {
      setIsRefreshing(true);
    } else {
      setIsLoading(true);
    }
    setLoadError(false);

    try {
      if (forceRefresh) {
        await invalidatePregnancyCache(userId);
      }
      const [homeData, briefingSignals] = await Promise.all([
        loadPregnancyHomeDataWithCache(userId),
        loadPregnancyBriefingSignals(userId),
      ]);
      if (currentRequest !== requestVersion.current) return;

      setCurrentWeek(homeData.dueDate.currentWeek);
      setCurrentDay(homeData.dueDate.currentDay);
      setSignals(briefingSignals);
      setHasLoadedOnce(true);
    } catch (error) {
      if (currentRequest !== requestVersion.current) return;
      console.error('Pregnancy briefing screen: failed to load briefing', error);
      setLoadError(true);
    } finally {
      if (currentRequest === requestVersion.current) {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    }
  }, [access.hasAccess, userId]);

  useFocusEffect(
    useCallback(() => {
      if (access.hasAccess !== true) return undefined;
      const timeoutId = setTimeout(() => {
        void loadBriefing();
      }, 0);
      return () => {
        clearTimeout(timeoutId);
        requestVersion.current += 1;
      };
    }, [access.hasAccess, loadBriefing]),
  );

  const handleItemPress = useCallback((item: PregnancyBriefingItem) => {
    if (Platform.OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
    router.push(item.destination as never);
  }, [router]);

  const openPaywall = useCallback(() => {
    router.push('/paywall?origin=pregnancy_briefing' as never);
  }, [router]);

  const screenOptions = {
    headerShown: true,
    title: t('screen.title'),
    headerTransparent: true,
    headerShadowVisible: false,
    headerBackButtonDisplayMode: 'minimal' as const,
    headerTintColor: textPrimary,
  };

  if (access.hasAccess === false) {
    return (
      <>
        <Stack.Screen options={{ headerShown: false }} />
        <LockedFeatureScreen
          feature="pregnancyBriefing"
          headerTitle={t('screen.title')}
          headerSubtitle={t('screen.subtitle')}
        />
      </>
    );
  }

  return (
    <ThemedBackground style={styles.background}>
      <Stack.Screen options={screenOptions} />
      <StatusBar barStyle={isDark ? 'light-content' : 'dark-content'} />
      <ScrollView
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={isRefreshing}
            onRefresh={() => void loadBriefing(true)}
            tintColor={textPrimary}
            colors={['#5E3DB3']}
          />
        }
      >
        {access.hasAccess === null ? (
          <View style={styles.centerState}>
            <ActivityIndicator size="large" color="#5E3DB3" />
          </View>
        ) : loadError && !hasLoadedOnce ? (
          <View style={styles.errorCard}>
            <View style={styles.errorIcon}>
              <IconSymbol name="arrow.clockwise" size={22} color="#5E3DB3" />
            </View>
            <Text selectable style={[styles.errorText, { color: textPrimary }]}>
              {t('state.error')}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => void loadBriefing()}
              style={({ pressed }) => [styles.retryButton, pressed && styles.pressed]}
            >
              <Text style={styles.retryButtonText}>{t('state.retry')}</Text>
            </Pressable>
          </View>
        ) : (
          <PregnancyBriefingCard
            locale={locale}
            briefing={briefing}
            hasAccess={access.hasAccess}
            isLoading={isLoading}
            isDark={isDark}
            variant="full"
            onItemPress={handleItemPress}
            onUnlock={openPaywall}
          />
        )}
      </ScrollView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
  },
  centerState: {
    minHeight: 320,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorCard: {
    minHeight: 240,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 14,
    padding: 24,
    borderRadius: 26,
    borderCurve: 'continuous',
    backgroundColor: 'rgba(255,255,255,0.68)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.8)',
    boxShadow: '0 10px 24px rgba(75,45,117,0.12)',
  },
  errorIcon: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(94,61,179,0.12)',
  },
  errorText: {
    maxWidth: 300,
    textAlign: 'center',
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
  },
  retryButton: {
    minHeight: 44,
    justifyContent: 'center',
    paddingHorizontal: 18,
    borderRadius: 14,
    borderCurve: 'continuous',
    backgroundColor: '#5E3DB3',
  },
  retryButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '800',
  },
  pressed: {
    opacity: 0.78,
  },
});
