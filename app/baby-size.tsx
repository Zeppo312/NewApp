import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, SafeAreaView, ScrollView } from 'react-native';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ThemedBackground } from '@/components/ThemedBackground';
import Header from '@/components/Header';
import BabySizeDetail, { clampBabySizeWeek } from '@/components/BabySizeDetail';
import { useAuth } from '@/contexts/AuthContext';
import { getDueDateWithLinkedUsers } from '@/lib/supabase';
import { useLocale } from '@/contexts/LocaleContext';
import { translateBabySizeText, type BabySizeTranslationKey } from '@/lib/babySizeTranslations';
import { LAYOUT_PAD, TIMELINE_INSET } from '@/constants/DesignGuide';

const DAYS_IN_PREGNANCY = 280;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const deriveWeekFromDueDate = (dueDate: Date) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);

  const diffMs = due.getTime() - now.getTime();
  const daysRemaining = Math.max(0, Math.round(diffMs / MS_PER_DAY));
  const daysPregnant = Math.min(DAYS_IN_PREGNANCY, Math.max(0, DAYS_IN_PREGNANCY - daysRemaining));
  const weeksPregnant = Math.floor(daysPregnant / 7);
  return clampBabySizeWeek(weeksPregnant + 1);
};

export default function BabySizePage() {
  return (
    <>
      <Stack.Screen options={{ headerShown: false }} />
      <BabySizeContent />
    </>
  );
}

function BabySizeContent() {
  const { locale } = useLocale();
  const t = (key: BabySizeTranslationKey, params?: Record<string, string | number>) =>
    translateBabySizeText(locale, key, params);
  const router = useRouter();
  const params = useLocalSearchParams<{ week?: string | string[] }>();
  const weekParam = params.week;
  const { user } = useAuth();
  const [dueWeek, setDueWeek] = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;

    const fetchDueWeek = async () => {
      if (!user?.id) {
        if (isMounted) {
          setDueWeek(null);
        }
        return;
      }

      try {
        const result = await getDueDateWithLinkedUsers(user.id);

        if (!isMounted) {
          return;
        }

        if (result?.success && result.dueDate) {
          const week = deriveWeekFromDueDate(new Date(result.dueDate));
          setDueWeek(week);
        } else {
          setDueWeek(null);
        }
      } catch (error) {
        console.error('Failed to load due date for baby size view:', error);
        if (isMounted) {
          setDueWeek(null);
        }
      }
    };

    fetchDueWeek();

    return () => {
      isMounted = false;
    };
  }, [user?.id]);

  const weekFromParams = useMemo(() => {
    if (typeof weekParam === 'undefined') {
      return null;
    }
    const rawWeek = Array.isArray(weekParam) ? weekParam[0] : weekParam;
    const parsedWeek = Number.parseInt(rawWeek ?? '', 10);
    if (Number.isNaN(parsedWeek)) {
      return null;
    }
    return clampBabySizeWeek(parsedWeek);
  }, [weekParam]);

  const currentWeek = weekFromParams ?? dueWeek ?? 1;

  return (
    <ThemedBackground style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <Header
          title={t('screen.title')}
          subtitle={t('screen.weekSubtitle', { week: currentWeek })}
          showBackButton
        />

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
        >
          <BabySizeDetail
            week={currentWeek}
            onWeekChange={(week) => router.setParams({ week: week.toString() })}
            cardStyle={styles.card}
          />
        </ScrollView>
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    paddingHorizontal: LAYOUT_PAD,
    paddingBottom: 40,
    paddingTop: 20,
    alignItems: 'center',
  },
  card: {
    marginHorizontal: TIMELINE_INSET,
  },
});
