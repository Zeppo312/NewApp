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
import { usePregnancyAge } from '@/hooks/use-pregnancy-age';

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
  const [dueDate, setDueDate] = useState<unknown>(null);
  const age = usePregnancyAge(dueDate);
  const dueWeek = age ? clampBabySizeWeek(age.runningWeek) : null;

  useEffect(() => {
    let isMounted = true;

    const fetchDueWeek = async () => {
      if (!user?.id) {
        if (isMounted) {
          setDueDate(null);
        }
        return;
      }

      try {
        const result = await getDueDateWithLinkedUsers(user.id);

        if (!isMounted) {
          return;
        }

        if (result?.success && result.dueDate) {
          setDueDate(result.dueDate);
        } else {
          setDueDate(null);
        }
      } catch (error) {
        console.error('Failed to load due date for baby size view:', error);
        if (isMounted) {
          setDueDate(null);
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
