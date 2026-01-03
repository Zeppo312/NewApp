import React, { useState, useEffect, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Animated, Easing, StyleSheet, ScrollView, View, TouchableOpacity, Text, SafeAreaView, StatusBar, Image, ActivityIndicator, RefreshControl, Alert, Platform, StyleProp, ViewStyle } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';
import { ThemedText } from '@/components/ThemedText';
import { ThemedView } from '@/components/ThemedView';
import { ThemedBackground } from '@/components/ThemedBackground';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useAuth } from '@/contexts/AuthContext';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { LinearGradient } from 'expo-linear-gradient';
import { Canvas, RoundedRect, LinearGradient as SkiaLinearGradient, RadialGradient, Circle, vec } from '@shopify/react-native-skia';
import { getBabyInfo, getDiaryEntries, getCurrentPhase, getPhaseProgress, getMilestonesByPhase } from '@/lib/baby';
import { supabase, addBabyCareEntry } from '@/lib/supabase';
import { getRecommendations, LottiRecommendation } from '@/lib/supabase/recommendations';
import { BlurView } from 'expo-blur';
import ActivityInputModal from '@/components/ActivityInputModal';
import SleepQuickAddModal, { SleepQuickEntry } from '@/components/SleepQuickAddModal';

// Tägliche Tipps für Mamas
const dailyTips = [
  "Nimm dir heute 10 Minuten nur für dich – eine kleine Auszeit kann Wunder wirken!",
  "Trinke ausreichend Wasser – besonders wichtig für dich und dein Baby.",
  "Ein kurzer Spaziergang an der frischen Luft kann deine Stimmung heben.",
  "Bitte um Hilfe, wenn du sie brauchst – du musst nicht alles alleine schaffen.",
  "Genieße die kleinen Momente mit deinem Baby – sie wachsen so schnell.",
  "Schlaf, wann immer dein Baby schläft – Ruhe ist wichtig für dich.",
  "Lass die Hausarbeit auch mal liegen – dein Wohlbefinden hat Vorrang.",
  "Feiere jeden kleinen Fortschritt – sowohl deinen als auch den deines Babys.",
  "Vertraue deinem Instinkt – du kennst dein Baby am besten.",
  "Vergiss nicht zu essen – deine Energie ist wichtig für dich und dein Baby."
];

const HOME_CACHE_KEY_PREFIX = 'home-cache-v1';

type HomeCachePayload = {
  cachedAt: string;
  profile?: {
    userName: string;
    avatarUrl: string | null;
  };
  babyInfo?: any;
  diaryEntries?: any[];
  dailyEntries?: any[];
  dailyEntriesDate?: string;
  currentPhase?: any;
  phaseProgress?: any;
  milestones?: any[];
  recommendations?: LottiRecommendation[];
  todaySleepMinutes?: number;
};

const getCacheDayKey = (date: Date = new Date()) => date.toISOString().split('T')[0];

const buildHomeCacheKey = (userId: string) => `${HOME_CACHE_KEY_PREFIX}:${userId}`;

function GlassBorderGlint({ radius = 30 }: { radius?: number }) {
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(anim, {
          toValue: 1,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 4200,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ])
    );

    animation.start();
    return () => animation.stop();
  }, [anim]);

  const translateX = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [-120, 120],
  });

  const translateY = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [6, -6],
  });

  return (
    <View
      pointerEvents="none"
      style={[
        StyleSheet.absoluteFill,
        { borderRadius: radius, overflow: 'hidden' },
      ]}
    >
      <Animated.View
        style={{
          position: 'absolute',
          top: 2,
          left: -140,
          width: 220,
          height: 8,
          opacity: 0.65,
          transform: [{ translateX }, { translateY }, { rotate: '-10deg' }],
        }}
      >
        <LinearGradient
          colors={[
            'rgba(255,255,255,0)',
            'rgba(255,255,255,0.6)',
            'rgba(255,255,255,0)',
          ]}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={{
            width: '100%',
            height: '100%',
          }}
        />
      </Animated.View>
    </View>
  );
}

function GlassLensOverlay({ radius = 20 }: { radius?: number }) {
  const [layout, setLayout] = useState({ width: 0, height: 0 });
  const width = layout.width;
  const height = layout.height;
  const minDim = Math.min(width, height);
  const maxDim = Math.max(width, height);
  const lensRadius = Math.min(radius, minDim / 2);
  const strokeRadius = Math.max(0, lensRadius - 1);

  return (
    <View
      pointerEvents="none"
      style={[StyleSheet.absoluteFillObject, { borderRadius: radius, overflow: 'hidden' }]}
      onLayout={(event) => {
        const { width, height } = event.nativeEvent.layout;
        if (width !== layout.width || height !== layout.height) {
          setLayout({ width, height });
        }
      }}
    >
      {width > 0 && height > 0 ? (
        <Canvas style={{ width, height }}>
          <RoundedRect x={0} y={0} width={width} height={height} r={lensRadius}>
            <SkiaLinearGradient
              start={vec(0, 0)}
              end={vec(width, height)}
              colors={[
                'rgba(255, 255, 255, 0.45)',
                'rgba(94, 61, 179, 0.08)',
                'rgba(255, 255, 255, 0.18)',
              ]}
              positions={[0, 0.6, 1]}
            />
          </RoundedRect>
          <RoundedRect x={0} y={0} width={width} height={height} r={lensRadius}>
            <RadialGradient
              c={vec(width * 0.2, height * 0.15)}
              r={maxDim * 0.9}
              colors={['rgba(255, 255, 255, 0.55)', 'rgba(255, 255, 255, 0)']}
            />
          </RoundedRect>
          <RoundedRect x={0} y={0} width={width} height={height} r={lensRadius}>
            <RadialGradient
              c={vec(width * 0.85, height * 0.85)}
              r={maxDim * 0.8}
              colors={['rgba(94, 61, 179, 0)', 'rgba(94, 61, 179, 0.18)']}
            />
          </RoundedRect>
          <RoundedRect
            x={0.5}
            y={0.5}
            width={width - 1}
            height={height - 1}
            r={strokeRadius}
            style="stroke"
            strokeWidth={1}
            color="rgba(255, 255, 255, 0.6)"
          />
          <Circle cx={width * 0.22} cy={height * 0.28} r={minDim * 0.18}>
            <RadialGradient
              c={vec(width * 0.22, height * 0.28)}
              r={minDim * 0.18}
              colors={['rgba(255, 255, 255, 0.7)', 'rgba(255, 255, 255, 0)']}
            />
          </Circle>
          <Circle cx={width * 0.72} cy={height * 0.18} r={minDim * 0.1}>
            <RadialGradient
              c={vec(width * 0.72, height * 0.18)}
              r={minDim * 0.1}
              colors={['rgba(255, 255, 255, 0.6)', 'rgba(255, 255, 255, 0)']}
            />
          </Circle>
        </Canvas>
      ) : null}
    </View>
  );
}

function TipHighlightDots() {
  const dotOne = useRef(new Animated.Value(0)).current;
  const dotTwo = useRef(new Animated.Value(0)).current;
  const dotThree = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const createPulse = (value: Animated.Value, delayMs: number) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(delayMs),
          Animated.timing(value, {
            toValue: 1,
            duration: 900,
            easing: Easing.out(Easing.quad),
            useNativeDriver: true,
          }),
          Animated.timing(value, {
            toValue: 0,
            duration: 900,
            easing: Easing.in(Easing.quad),
            useNativeDriver: true,
          }),
        ])
      );

    const pulseOne = createPulse(dotOne, 0);
    const pulseTwo = createPulse(dotTwo, 500);
    const pulseThree = createPulse(dotThree, 1000);

    pulseOne.start();
    pulseTwo.start();
    pulseThree.start();

    return () => {
      pulseOne.stop();
      pulseTwo.stop();
      pulseThree.stop();
    };
  }, [dotOne, dotTwo, dotThree]);

  const makeDotStyle = (value: Animated.Value) => ({
    opacity: value.interpolate({ inputRange: [0, 1], outputRange: [0.2, 0.95] }),
    transform: [
      { scale: value.interpolate({ inputRange: [0, 1], outputRange: [0.6, 1.25] }) },
    ],
  });

  return (
    <View pointerEvents="none" style={styles.tipHighlightContainer}>
      <Animated.View style={[styles.tipHighlightDot, styles.tipHighlightDotOne, makeDotStyle(dotOne)]} />
      <Animated.View style={[styles.tipHighlightDot, styles.tipHighlightDotTwo, makeDotStyle(dotTwo)]} />
      <Animated.View style={[styles.tipHighlightDot, styles.tipHighlightDotThree, makeDotStyle(dotThree)]} />
    </View>
  );
}

export default function HomeScreen() {
  const colorScheme = useColorScheme() ?? 'light';
  const theme = Colors[colorScheme];
  const { user } = useAuth();
  const router = useRouter();
  const DEFAULT_OVERVIEW_HEIGHT = 230;
  const PRODUCT_ROTATION_INITIAL_DELAY_MS = 10000;
  const PRODUCT_ROTATION_INTERVAL_MS = 20000;
  const OVERVIEW_ROTATION_INTERVAL_MS = 20000;
  const OVERVIEW_SLIDE_COUNT = 2;

  const [babyInfo, setBabyInfo] = useState<any>(null);
  const [diaryEntries, setDiaryEntries] = useState<any[]>([]);
  const [dailyEntries, setDailyEntries] = useState<any[]>([]);
  const [currentPhase, setCurrentPhase] = useState<any>(null);
  const [phaseProgress, setPhaseProgress] = useState<any>(null);
  const [milestones, setMilestones] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dailyTip, setDailyTip] = useState("");
  const [userName, setUserName] = useState("");
  const [recommendations, setRecommendations] = useState<LottiRecommendation[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [showInputModal, setShowInputModal] = useState(false);
  const [selectedActivityType, setSelectedActivityType] = useState<'feeding' | 'diaper' | 'other'>('feeding');
  const [selectedSubType, setSelectedSubType] = useState<string | null>(null);
  const [todaySleepMinutes, setTodaySleepMinutes] = useState(0);
  const [profileAvatarUrl, setProfileAvatarUrl] = useState<string | null>(null);
  const [showSleepModal, setShowSleepModal] = useState(false);
  const [sleepModalStart, setSleepModalStart] = useState(new Date());
  const [recommendationImageRetryKey, setRecommendationImageRetryKey] = useState(0);
  const [recommendationImageErrorCount, setRecommendationImageErrorCount] = useState(0);
  const [recommendationImageFailed, setRecommendationImageFailed] = useState(false);
  const MAX_IMAGE_RETRIES = 1;
  const [productIndex, setProductIndex] = useState(0);
  const [overviewCarouselWidth, setOverviewCarouselWidth] = useState(0);
  const [overviewIndex, setOverviewIndex] = useState(0);
  const [overviewSummaryHeight, setOverviewSummaryHeight] = useState<number | null>(null);
  const overviewScrollRef = useRef<ScrollView | null>(null);
  const homeCacheRef = useRef<HomeCachePayload | null>(null);
  const productIndexRef = useRef(0);
  const productRotationTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const productRotationCycleRef = useRef(0);
  const imageRetryTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const androidBlurProps =
    Platform.OS === 'android'
      ? { experimentalBlurMethod: 'dimezisBlurView' as const, blurReductionFactor: 1 }
      : {};

  const rotationCandidates = recommendations;

  const featuredRecommendation = rotationCandidates[productIndex] ?? null;

  const triggerHaptic = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  };

  const handleNavigate = (destination: any) => {
    triggerHaptic();
    router.push(destination);
  };

  const buildImageUri = (imageUrl?: string | null, retryKey = recommendationImageRetryKey) => {
    if (!imageUrl) return '';
    if (retryKey <= 0) return imageUrl;
    return `${imageUrl}${imageUrl.includes('?') ? '&' : '?'}r=${retryKey}`;
  };

  const getPreviewText = (value?: string | null, limit = 10) => {
    if (!value) return '';
    const words = value.trim().split(/\s+/).filter(Boolean);
    if (words.length <= limit) return value.trim();
    return `${words.slice(0, limit).join(' ')}...`;
  };

  const resetHomeState = () => {
    setBabyInfo(null);
    setDiaryEntries([]);
    setDailyEntries([]);
    setCurrentPhase(null);
    setPhaseProgress(null);
    setMilestones([]);
    setUserName('');
    setProfileAvatarUrl(null);
    setRecommendations([]);
    setTodaySleepMinutes(0);
  };

  const loadCachedData = async () => {
    if (!user?.id) return false;
    try {
      const cachedStr = await AsyncStorage.getItem(buildHomeCacheKey(user.id));
      if (!cachedStr) return false;

      const cached: HomeCachePayload = JSON.parse(cachedStr);
      if (!cached || typeof cached !== 'object') return false;

      homeCacheRef.current = cached;

      if (cached.profile) {
        setUserName(cached.profile.userName ?? '');
        setProfileAvatarUrl(cached.profile.avatarUrl ?? null);
      }

      if (cached.babyInfo !== undefined) {
        setBabyInfo(cached.babyInfo);
      }

      if (Array.isArray(cached.diaryEntries)) {
        setDiaryEntries(cached.diaryEntries);
      }

      const todayKey = getCacheDayKey();
      if (cached.dailyEntriesDate === todayKey && Array.isArray(cached.dailyEntries)) {
        setDailyEntries(cached.dailyEntries);
        if (typeof cached.todaySleepMinutes === 'number') {
          setTodaySleepMinutes(cached.todaySleepMinutes);
        }
      } else {
        setDailyEntries([]);
        setTodaySleepMinutes(0);
      }

      if (cached.currentPhase !== undefined) {
        setCurrentPhase(cached.currentPhase);
      }
      if (cached.phaseProgress !== undefined) {
        setPhaseProgress(cached.phaseProgress);
      }
      if (Array.isArray(cached.milestones)) {
        setMilestones(cached.milestones);
      }
      if (Array.isArray(cached.recommendations)) {
        setRecommendations(cached.recommendations);
      }

      setIsLoading(false);
      return true;
    } catch (error) {
      console.error('Error loading home cache:', error);
      return false;
    }
  };

  const saveHomeCache = async (updates: Partial<HomeCachePayload>) => {
    if (!user?.id) return;
    try {
      const existing = homeCacheRef.current ?? {};
      const next: HomeCachePayload = {
        cachedAt: new Date().toISOString(),
        profile: {
          userName: updates.profile?.userName ?? existing.profile?.userName ?? userName,
          avatarUrl: updates.profile?.avatarUrl ?? existing.profile?.avatarUrl ?? profileAvatarUrl ?? null,
        },
        babyInfo: updates.babyInfo ?? existing.babyInfo ?? babyInfo,
        diaryEntries: updates.diaryEntries ?? existing.diaryEntries ?? diaryEntries,
        dailyEntries: updates.dailyEntries ?? existing.dailyEntries ?? dailyEntries,
        dailyEntriesDate: updates.dailyEntriesDate ?? existing.dailyEntriesDate ?? getCacheDayKey(),
        currentPhase: updates.currentPhase ?? existing.currentPhase ?? currentPhase,
        phaseProgress: updates.phaseProgress ?? existing.phaseProgress ?? phaseProgress,
        milestones: updates.milestones ?? existing.milestones ?? milestones,
        recommendations: updates.recommendations ?? existing.recommendations ?? recommendations,
        todaySleepMinutes: updates.todaySleepMinutes ?? existing.todaySleepMinutes ?? todaySleepMinutes,
      };
      homeCacheRef.current = next;
      await AsyncStorage.setItem(buildHomeCacheKey(user.id), JSON.stringify(next));
    } catch (error) {
      console.error('Error saving home cache:', error);
    }
  };

  useEffect(() => {
    if (featuredRecommendation?.image_url) {
      Image.prefetch(featuredRecommendation.image_url).catch(() => {});
    }
  }, [featuredRecommendation?.image_url]);

  useEffect(() => {
    setRecommendationImageRetryKey(0);
    setRecommendationImageErrorCount(0);
    setRecommendationImageFailed(false);
    if (imageRetryTimeoutRef.current) {
      clearTimeout(imageRetryTimeoutRef.current);
      imageRetryTimeoutRef.current = null;
    }
  }, [featuredRecommendation?.id, featuredRecommendation?.image_url]);

  useEffect(() => {
    productIndexRef.current = productIndex;
  }, [productIndex]);

  useEffect(() => {
    productIndexRef.current = 0;
    setProductIndex(0);
    productRotationCycleRef.current = 0;
  }, [rotationCandidates]);

  useEffect(() => {
    if (rotationCandidates.length <= 1) {
      if (productRotationTimeoutRef.current) {
        clearTimeout(productRotationTimeoutRef.current);
        productRotationTimeoutRef.current = null;
      }
      productRotationCycleRef.current = 0;
      return;
    }

    const scheduleNextRotation = () => {
      const delay =
        productRotationCycleRef.current === 0
          ? PRODUCT_ROTATION_INITIAL_DELAY_MS
          : PRODUCT_ROTATION_INTERVAL_MS;

      productRotationTimeoutRef.current = setTimeout(() => {
        const nextIndex = (productIndexRef.current + 1) % rotationCandidates.length;
        productIndexRef.current = nextIndex;
        setProductIndex(nextIndex);
        productRotationCycleRef.current += 1;
        scheduleNextRotation();
      }, delay);
    };

    scheduleNextRotation();

    return () => {
      if (productRotationTimeoutRef.current) {
        clearTimeout(productRotationTimeoutRef.current);
        productRotationTimeoutRef.current = null;
      }
    };
  }, [rotationCandidates, PRODUCT_ROTATION_INITIAL_DELAY_MS, PRODUCT_ROTATION_INTERVAL_MS]);

  useEffect(() => {
    if (!overviewCarouselWidth) return;

    const interval = setInterval(() => {
      setOverviewIndex((current) => {
        const nextIndex = (current + 1) % OVERVIEW_SLIDE_COUNT;
        overviewScrollRef.current?.scrollTo({
          x: overviewCarouselWidth * nextIndex,
          animated: true,
        });
        return nextIndex;
      });
    }, OVERVIEW_ROTATION_INTERVAL_MS);

    return () => clearInterval(interval);
  }, [overviewCarouselWidth, OVERVIEW_ROTATION_INTERVAL_MS, OVERVIEW_SLIDE_COUNT]);

  useEffect(() => {
    let isActive = true;

    const init = async () => {
      if (!user) {
        resetHomeState();
        homeCacheRef.current = null;
        setIsLoading(false);
        return;
      }

      resetHomeState();
      homeCacheRef.current = null;
      const cacheLoaded = await loadCachedData();
      if (!isActive) return;

      // Wähle einen zufälligen Tipp für den Tag
      const randomTip = dailyTips[Math.floor(Math.random() * dailyTips.length)];
      setDailyTip(randomTip);

      await loadData({ skipLoading: cacheLoaded });
    };

    init();

    return () => {
      isActive = false;
    };
  }, [user]);

  // Funktion für Pull-to-Refresh
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      // Lade die Daten neu
      await loadData();
      // Wähle einen neuen zufälligen Tipp
      const randomTip = dailyTips[Math.floor(Math.random() * dailyTips.length)];
      setDailyTip(randomTip);
    } catch (error) {
      console.error('Error during refresh:', error);
    } finally {
      setRefreshing(false);
    }
  };

  const loadData = async (options?: { skipLoading?: boolean }) => {
    try {
      if (!refreshing && !options?.skipLoading) {
        setIsLoading(true);
      }

      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      const todayKey = getCacheDayKey(today);

      let nextProfileName = userName;
      let nextProfileAvatar = profileAvatarUrl ?? null;
      let nextBabyInfo = babyInfo;
      let nextDiaryEntries = diaryEntries;
      let nextDailyEntries = dailyEntries;
      let nextCurrentPhase = currentPhase;
      let nextPhaseProgress = phaseProgress;
      let nextMilestones = milestones;
      let nextRecommendations = recommendations;
      let nextSleepMinutes = todaySleepMinutes;

      // Benutzernamen laden
      const { data: profileData, error: profileError } = await supabase
        .from('profiles')
        .select('first_name, avatar_url')
        .eq('id', user?.id)
        .single();

      if (profileError) {
        console.error('Error loading user profile:', profileError);
      } else if (profileData) {
        if (profileData.first_name) {
          nextProfileName = profileData.first_name;
          setUserName(profileData.first_name);
        }
        nextProfileAvatar = profileData.avatar_url || null;
        setProfileAvatarUrl(nextProfileAvatar);
      }

      // Baby-Informationen laden
      const { data: babyData } = await getBabyInfo();
      nextBabyInfo = babyData;
      setBabyInfo(babyData);

      // Tagebucheinträge laden (nur die neuesten 5)
      const { data: diaryData } = await getDiaryEntries();
      if (diaryData) {
        const diaryPreview = diaryData.slice(0, 5);
        nextDiaryEntries = diaryPreview;
        setDiaryEntries(diaryPreview);
      }

      // Alltags-Einträge für heute laden
      const { data: dailyData, error: dailyError } = await supabase
        .from('baby_care_entries')
        .select('*')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: false });

      if (!dailyError && Array.isArray(dailyData)) {
        nextDailyEntries = dailyData;
        setDailyEntries(dailyData);
      }

      const sleepMinutes = await fetchTodaySleepMinutes(startOfDay, endOfDay);
      if (sleepMinutes !== null) {
        nextSleepMinutes = sleepMinutes;
      }

      // Aktuelle Entwicklungsphase laden
      const { data: phaseData } = await getCurrentPhase();
      if (phaseData) {
        nextCurrentPhase = phaseData;
        setCurrentPhase(phaseData);

        // Fortschritt für die aktuelle Phase berechnen
        const { progress, completedCount, totalCount } = await getPhaseProgress(phaseData.phase_id);
        nextPhaseProgress = { progress, completedCount, totalCount };
        setPhaseProgress(nextPhaseProgress);

        // Meilensteine für die aktuelle Phase laden
        const { data: milestonesData } = await getMilestonesByPhase(phaseData.phase_id);
        if (milestonesData) {
          nextMilestones = milestonesData;
          setMilestones(milestonesData);
        }
      }

      try {
        const recommendationData = await getRecommendations();
        nextRecommendations = recommendationData;
        setRecommendations(recommendationData);
      } catch (error) {
        console.error('Error loading recommendations:', error);
      }

      await saveHomeCache({
        profile: { userName: nextProfileName, avatarUrl: nextProfileAvatar },
        babyInfo: nextBabyInfo,
        diaryEntries: nextDiaryEntries,
        dailyEntries: nextDailyEntries,
        dailyEntriesDate: todayKey,
        currentPhase: nextCurrentPhase,
        phaseProgress: nextPhaseProgress,
        milestones: nextMilestones,
        recommendations: nextRecommendations,
        todaySleepMinutes: nextSleepMinutes,
      });
    } catch (err) {
      console.error('Failed to load home data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Formatiere das aktuelle Datum
  const formatDate = () => {
    const options: Intl.DateTimeFormatOptions = {
      weekday: 'long',
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    };
    return new Date().toLocaleDateString('de-DE', options);
  };

  // Berechne die Anzahl der heutigen Mahlzeiten
  const getTodayFeedings = () => {
    return dailyEntries.filter(entry => entry.entry_type === 'feeding').length;
  };

  // Berechne die Anzahl der heutigen Windelwechsel
  const getTodayDiaperChanges = () => {
    return dailyEntries.filter(entry => entry.entry_type === 'diaper').length;
  };

  const formatMinutes = (minutes: number) => {
    if (!minutes || minutes <= 0) return '0m';
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  // Berechne die Anzahl der heutigen Einträge (für Referenz, wird nicht mehr angezeigt)
  const getTodayEntries = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return diaryEntries.filter(entry => {
      const entryDate = new Date(entry.entry_date);
      entryDate.setHours(0, 0, 0, 0);
      return entryDate.getTime() === today.getTime();
    }).length;
  };

  // Berechne die Anzahl der heute erreichten Meilensteine (für Referenz, wird nicht mehr angezeigt)
  const getTodayMilestones = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    return milestones.filter(milestone => {
      if (!milestone.completion_date) return false;
      const completionDate = new Date(milestone.completion_date);
      completionDate.setHours(0, 0, 0, 0);
      return completionDate.getTime() === today.getTime();
    }).length;
  };

  // Handle stat item press
  const handleStatPress = (type: 'feeding' | 'diaper' | 'sleep') => {
    triggerHaptic();
    if (type === 'sleep') {
      router.push('/(tabs)/sleep-tracker');
      return;
    }
    setSelectedActivityType(type);
    setSelectedSubType(null);
    setShowInputModal(true);
  };

  // Load only daily entries (for quick refresh after adding entries)
  const loadDailyEntriesOnly = async () => {
    try {
      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);

      console.log('Loading daily entries for date:', today.toISOString());

      // Direct query to baby_care_entries table to ensure fresh data
      const { data: dailyData, error } = await supabase
        .from('baby_care_entries')
        .select('*')
        .gte('start_time', startOfDay.toISOString())
        .lte('start_time', endOfDay.toISOString())
        .order('start_time', { ascending: false });

      if (error) {
        console.error('Error loading daily entries:', error);
        return;
      }

      let nextDailyEntries = dailyEntries;
      if (dailyData) {
        console.log('Loaded daily entries:', dailyData.length, 'entries');
        nextDailyEntries = dailyData;
        setDailyEntries(dailyData);
      }

      const sleepMinutes = await fetchTodaySleepMinutes(startOfDay, endOfDay);
      if (dailyData || sleepMinutes !== null) {
        await saveHomeCache({
          dailyEntries: nextDailyEntries,
          dailyEntriesDate: getCacheDayKey(today),
          todaySleepMinutes: sleepMinutes ?? todaySleepMinutes,
        });
      }
    } catch (err) {
      console.error('Failed to load daily entries:', err);
    }
  };

  const fetchTodaySleepMinutes = async (startOfDay: Date, endOfDay: Date) => {
    try {
      if (!user?.id) {
        setTodaySleepMinutes(0);
        return 0;
      }

      const startIso = startOfDay.toISOString();
      const endIso = endOfDay.toISOString();
      const overlapFilter = [
        `and(start_time.lte.${endIso},end_time.is.null)`,
        `and(start_time.lte.${endIso},end_time.gte.${startIso})`
      ].join(',');

      const { data, error } = await supabase
        .from('sleep_entries')
        .select('start_time,end_time')
        .eq('user_id', user.id)
        .or(overlapFilter);

      if (error || !data) {
        console.error('Error loading sleep entries for today:', error);
        setTodaySleepMinutes(0);
        return null;
      }

      const totalMinutes = data.reduce((sum, entry) => {
        const entryStart = new Date(entry.start_time);
        const rawEnd = entry.end_time ? new Date(entry.end_time) : new Date();
        const clampedStart = entryStart < startOfDay ? startOfDay : entryStart;
        const clampedEnd = rawEnd > endOfDay ? endOfDay : rawEnd;
        const diff = clampedEnd.getTime() - clampedStart.getTime();
        return diff > 0 ? sum + Math.round(diff / 60000) : sum;
      }, 0);

      setTodaySleepMinutes(totalMinutes);
      return totalMinutes;
    } catch (error) {
      console.error('Failed to calculate today sleep minutes:', error);
      setTodaySleepMinutes(0);
      return null;
    }
  };

  // Handle save entry from modal
  const handleSaveEntry = async (payload: any) => {
    console.log('handleSaveEntry - Received payload:', JSON.stringify(payload, null, 2));
    const entryType =
      payload?.entry_type === 'feeding' || payload?.entry_type === 'diaper'
        ? payload.entry_type
        : selectedActivityType;

    if (entryType !== 'feeding' && entryType !== 'diaper') {
      Alert.alert('Fehler', 'Unbekannter Eintragstyp. Bitte erneut versuchen.');
      return;
    }

    const { error } = await addBabyCareEntry({
      entry_type: entryType,
      start_time: payload.start_time,
      end_time: payload.end_time ?? null,
      notes: payload.notes ?? null,
      feeding_type: payload.feeding_type ?? null,
      feeding_volume_ml: payload.feeding_volume_ml ?? null,
      feeding_side: payload.feeding_side ?? null,
      diaper_type: payload.diaper_type ?? null,
    });

    if (error) {
      console.error('Error saving baby care entry:', error);
      Alert.alert('Fehler', 'Eintrag konnte nicht gespeichert werden.');
      return;
    }

    setShowInputModal(false);
    setSelectedActivityType('feeding');
    setSelectedSubType(null);

    // Quick reload of daily entries to show the new entry immediately
    await loadDailyEntriesOnly();
  };

  const handleSaveSleepQuickEntry = async (entry: SleepQuickEntry) => {
    if (!user?.id) {
      Alert.alert('Hinweis', 'Bitte melde dich an, um Schlaf zu speichern.');
      return;
    }
    try {
      const payload = {
        user_id: user.id,
        start_time: entry.start.toISOString(),
        end_time: entry.end ? entry.end.toISOString() : null,
        quality: entry.quality,
        notes: entry.notes || null,
        duration_minutes: entry.end ? Math.max(0, Math.round((entry.end.getTime() - entry.start.getTime()) / 60000)) : null,
      };

      const { error } = await supabase.from('sleep_entries').insert(payload);
      if (error) {
        console.error('Error saving sleep entry:', error);
        Alert.alert('Fehler', 'Schlaf konnte nicht gespeichert werden.');
        return;
      }

      setShowSleepModal(false);

      const today = new Date();
      const startOfDay = new Date(today);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(today);
      endOfDay.setHours(23, 59, 59, 999);
      const sleepMinutes = await fetchTodaySleepMinutes(startOfDay, endOfDay);
      if (sleepMinutes !== null) {
        await saveHomeCache({
          todaySleepMinutes: sleepMinutes,
          dailyEntriesDate: getCacheDayKey(today),
        });
      }
    } catch (err) {
      console.error('Failed to save sleep entry:', err);
      Alert.alert('Fehler', 'Schlafeintrag konnte nicht gespeichert werden.');
    }
  };

  const handleFocusRecommendation = (recommendationId?: string | null) => {
    triggerHaptic();
    if (!recommendationId) {
      router.push('/lottis-empfehlungen');
      return;
    }
    router.push({
      pathname: '/lottis-empfehlungen',
      params: { focusId: recommendationId },
    });
  };

  // Rendere den Begrüßungsbereich
  const renderGreetingSection = () => {
    // Verwende den Benutzernamen aus der profiles-Tabelle
    const displayName = userName || 'Mama';

    const displayPhoto = profileAvatarUrl || null;

    return (
      <View style={[styles.liquidGlassWrapper, styles.greetingCardWrapper]}>
        <BlurView
          {...androidBlurProps}
          intensity={22}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[styles.liquidGlassBackground, styles.greetingGlassBackground]}
        >
          <ThemedView
            style={[styles.greetingContainer, styles.liquidGlassContainer, styles.greetingGlassContainer]}
            lightColor="rgba(255, 255, 255, 0.04)"
            darkColor="rgba(255, 255, 255, 0.02)"
          >
            <LinearGradient
              pointerEvents="none"
              colors={['rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0)', 'rgba(255, 255, 255, 0)']}
              locations={[0, 0.45, 1]}
              start={{ x: 0.15, y: 0.0 }}
              end={{ x: 0.85, y: 1.0 }}
              style={styles.greetingGloss}
            />

            <View style={styles.greetingHeader}>
              <View>
                <ThemedText style={[styles.greeting, styles.liquidGlassText, { color: '#6B4C3B' }]}>
                  Hallo {displayName}!
                </ThemedText>
                <ThemedText style={[styles.dateText, styles.liquidGlassSecondaryText, { color: '#6B4C3B' }]}>
                  {formatDate()}
                </ThemedText>
              </View>

              <View style={styles.profileBadge}>
                {displayPhoto ? (
                  <View style={styles.profileImageWrapper}>
                    <Image source={{ uri: displayPhoto }} style={styles.profileImage} />
                  </View>
                ) : (
                  <View style={styles.profilePlaceholder}>
                    <IconSymbol name="person.fill" size={30} color="#FFFFFF" />
                  </View>
                )}
                <View style={styles.profileStatusDot} />
              </View>
            </View>

            <View style={styles.tipCard}>
              <GlassLensOverlay radius={20} />
              <TipHighlightDots />
              <View style={styles.tipCardRow}>
                <View style={styles.tipIconWrap}>
                  <IconSymbol name="lightbulb.fill" size={18} color="#D6B28C" />
                </View>
                <View style={styles.tipContent}>
                  <ThemedText style={styles.tipLabel}>Tipp des Tages</ThemedText>
                  <ThemedText style={styles.tipText}>{dailyTip}</ThemedText>
                </View>
              </View>
            </View>
          </ThemedView>
        </BlurView>
        <GlassBorderGlint radius={30} />
      </View>
    );
  };

  // Rendere die Tagesübersicht
  const renderDailySummary = (wrapperStyle?: StyleProp<ViewStyle>) => {
    const todayFeedings = getTodayFeedings();
    const todayDiaperChanges = getTodayDiaperChanges();

    return (
      <View
        style={[styles.liquidGlassWrapper, wrapperStyle]}
        onLayout={(event) => {
          const nextHeight = Math.round(event.nativeEvent.layout.height);
          if (nextHeight && nextHeight !== overviewSummaryHeight) {
            setOverviewSummaryHeight(nextHeight);
          }
        }}
      >
        <BlurView
          intensity={22}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={styles.liquidGlassBackground}
        >
          <ThemedView
            style={[styles.summaryContainer, styles.liquidGlassContainer]}
            lightColor="rgba(255, 255, 255, 0.04)"
            darkColor="rgba(255, 255, 255, 0.02)"
          >
            <TouchableOpacity
              style={styles.sectionTitleContainer}
              activeOpacity={0.85}
              onPress={() => handleNavigate('/(tabs)/daily_old')}
            >
              <ThemedText style={[styles.sectionTitle, { color: '#7D5A50', fontSize: 22 }]}>
                Dein Tag im Überblick
              </ThemedText>
              <View style={styles.liquidGlassChevron}>
                <IconSymbol name="chevron.right" size={20} color="#7D5A50" />
              </View>
            </TouchableOpacity>

            <View style={styles.statsContainer}>
              <TouchableOpacity
                style={[styles.statItem, styles.liquidGlassStatItem, {
                  backgroundColor: 'rgba(94, 61, 179, 0.13)',
                  borderColor: 'rgba(94, 61, 179, 0.35)'
                }]}
                activeOpacity={0.85}
                onPress={() => handleStatPress('feeding')}
              >
                <View style={styles.liquidGlassStatIcon}>
                  <Text style={styles.statEmoji}>🍼</Text>
                </View>
                <ThemedText style={[styles.statValue, styles.liquidGlassStatValue, {
                  color: '#5E3DB3',
                  textShadowColor: 'rgba(255, 255, 255, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }]}>{todayFeedings}</ThemedText>
                <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel, { color: '#7D5A50' }]}>Essen</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, styles.liquidGlassStatItem, {
                  backgroundColor: 'rgba(94, 61, 179, 0.08)',
                  borderColor: 'rgba(94, 61, 179, 0.22)'
                }]}
                activeOpacity={0.85}
                onPress={() => handleStatPress('diaper')}
              >
                <View style={styles.liquidGlassStatIcon}>
                  <Text style={styles.statEmoji}>💩</Text>
                </View>
                <ThemedText style={[styles.statValue, styles.liquidGlassStatValue, {
                  color: '#5E3DB3',
                  textShadowColor: 'rgba(255, 255, 255, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }]}>{todayDiaperChanges}</ThemedText>
                <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel, { color: '#7D5A50' }]}>Windeln</ThemedText>
              </TouchableOpacity>

              <TouchableOpacity
                style={[styles.statItem, styles.liquidGlassStatItem, { 
                  backgroundColor: 'rgba(94, 61, 179, 0.05)', 
                  borderColor: 'rgba(94, 61, 179, 0.15)' 
                }]}
                activeOpacity={0.85}
                onPress={() => handleStatPress('sleep')}
              >
                <View style={styles.liquidGlassStatIcon}>
                  <Text style={styles.statEmoji}>💤</Text>
                </View>
                <ThemedText style={[styles.statValue, styles.liquidGlassStatValue, { 
                  color: '#5E3DB3',
                  textShadowColor: 'rgba(255, 255, 255, 0.8)',
                  textShadowOffset: { width: 0, height: 1 },
                  textShadowRadius: 2,
                }]}>{formatMinutes(todaySleepMinutes)}</ThemedText>
                <ThemedText style={[styles.statLabel, styles.liquidGlassStatLabel, { color: '#7D5A50' }]}>Schlaf</ThemedText>
              </TouchableOpacity>
            </View>
          </ThemedView>
        </BlurView>
      </View>
    );
  };

  const handleRecommendationImageError = () => {
    setRecommendationImageErrorCount((prev) => {
      if (prev >= MAX_IMAGE_RETRIES) {
        setRecommendationImageFailed(true);
        return prev;
      }
      const next = prev + 1;
      if (imageRetryTimeoutRef.current) {
        clearTimeout(imageRetryTimeoutRef.current);
      }
      imageRetryTimeoutRef.current = setTimeout(() => {
        setRecommendationImageRetryKey((key) => key + 1);
      }, 600);
      return next;
    });
  };

  const handleRecommendationImageLoadStart = () => {
    if (recommendationImageRetryKey >= MAX_IMAGE_RETRIES) return;
    if (imageRetryTimeoutRef.current) {
      clearTimeout(imageRetryTimeoutRef.current);
    }
    imageRetryTimeoutRef.current = setTimeout(() => {
      if (!recommendationImageFailed) {
        setRecommendationImageRetryKey((key) => key + 1);
      }
    }, 1500);
  };

  const handleRecommendationImageLoad = () => {
    if (imageRetryTimeoutRef.current) {
      clearTimeout(imageRetryTimeoutRef.current);
      imageRetryTimeoutRef.current = null;
    }
    setRecommendationImageFailed(false);
  };

  const renderRecommendationCard = (wrapperStyle?: StyleProp<ViewStyle>) => {
    const cardHeightStyle = {
      height: overviewSummaryHeight ?? DEFAULT_OVERVIEW_HEIGHT,
    };
    const buttonLabel = 'Mehr';
    const showRecommendationImage = Boolean(featuredRecommendation?.image_url) && !recommendationImageFailed;
    const imageUri = buildImageUri(featuredRecommendation?.image_url);

    return (
      <View style={[styles.liquidGlassWrapper, wrapperStyle, cardHeightStyle]}>
        <BlurView
          {...androidBlurProps}
          intensity={22}
          tint={colorScheme === 'dark' ? 'dark' : 'light'}
          style={[styles.liquidGlassBackground, cardHeightStyle]}
        >
          <ThemedView
            style={[
              styles.liquidGlassContainer,
              styles.recommendationContainer,
              cardHeightStyle,
            ]}
            lightColor="rgba(255, 255, 255, 0.04)"
            darkColor="rgba(255, 255, 255, 0.02)"
          >
            {featuredRecommendation ? (
              <View style={styles.recommendationCard}>
                <View style={styles.sectionTitleContainer}>
                  <ThemedText style={[styles.sectionTitle, styles.liquidGlassText, { color: '#6B4C3B', fontSize: 22 }]}>
                    Lottis Empfehlungen
                  </ThemedText>
                  <View style={[styles.liquidGlassChevron, styles.recommendationHeaderSpacer]} />
                </View>
                <TouchableOpacity
                  style={styles.recommendationInnerCard}
                  onPress={() => handleFocusRecommendation(featuredRecommendation.id)}
                  activeOpacity={0.9}
                >
                  <View style={styles.recommendationRow}>
                    <View style={styles.recommendationImagePane}>
                      {showRecommendationImage ? (
                        <Image
                          key={`${featuredRecommendation.id}-${recommendationImageRetryKey}`}
                          source={{ uri: imageUri }}
                          style={styles.recommendationImage}
                          onLoadStart={handleRecommendationImageLoadStart}
                          onError={handleRecommendationImageError}
                          onLoad={handleRecommendationImageLoad}
                        />
                      ) : (
                        <View style={styles.recommendationImageFallback}>
                          <IconSymbol name="bag.fill" size={22} color="#6B4C3B" />
                        </View>
                      )}
                    </View>
                    <View style={styles.recommendationContentPane}>
                      <View style={styles.recommendationTextWrap}>
                        <ThemedText style={styles.recommendationTitle}>
                          {featuredRecommendation.title}
                        </ThemedText>
                        <ThemedText style={styles.recommendationDescription}>
                          {getPreviewText(featuredRecommendation.description, 10)}
                        </ThemedText>
                      </View>
                      <View style={styles.recommendationButton}>
                        <ThemedText style={styles.recommendationButtonText} numberOfLines={1}>
                          {buttonLabel}
                        </ThemedText>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.recommendationEmptyWrapper}>
                <View style={styles.sectionTitleContainer}>
                  <ThemedText style={[styles.sectionTitle, styles.liquidGlassText, { color: '#6B4C3B', fontSize: 22 }]}>
                    Lottis Empfehlungen
                  </ThemedText>
                  <View style={[styles.liquidGlassChevron, styles.recommendationHeaderSpacer]} />
                </View>
                <View style={styles.recommendationEmpty}>
                  <IconSymbol name="bag.fill" size={20} color="#7D5A50" />
                  <ThemedText style={styles.recommendationEmptyText}>
                    Noch keine Empfehlungen verfügbar.
                  </ThemedText>
                </View>
              </View>
            )}
          </ThemedView>
        </BlurView>
      </View>
    );
  };

  const renderOverviewSection = () => (
    <View
      style={styles.overviewCarouselWrapper}
      onLayout={(event) => {
        const nextWidth = event.nativeEvent.layout.width;
        if (nextWidth && nextWidth !== overviewCarouselWidth) {
          setOverviewCarouselWidth(nextWidth);
        }
      }}
    >
      <ScrollView
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        ref={overviewScrollRef}
        style={styles.overviewCarousel}
        decelerationRate="fast"
        onMomentumScrollEnd={(event) => {
          if (!overviewCarouselWidth) return;
          const nextIndex = Math.round(event.nativeEvent.contentOffset.x / overviewCarouselWidth);
          setOverviewIndex(nextIndex);
        }}
        scrollEventThrottle={16}
      >
        {[
          renderDailySummary(styles.carouselCardWrapper),
          renderRecommendationCard(styles.carouselCardWrapper),
        ].map((slide, index) => (
          <View
            key={`overview-slide-${index}`}
            style={[
              styles.overviewSlide,
              overviewCarouselWidth ? { width: overviewCarouselWidth } : null,
            ]}
          >
            {slide}
          </View>
        ))}
      </ScrollView>
      <View style={styles.carouselDots}>
        {Array.from({ length: OVERVIEW_SLIDE_COUNT }, (_, index) => (
          <View
            key={`overview-dot-${index}`}
            style={[
              styles.carouselDot,
              overviewIndex === index && styles.carouselDotActive,
            ]}
          />
        ))}
      </View>
    </View>
  );

  // Rendere die Schnellzugriff-Karten
  const renderQuickAccessCards = () => {
    return (
      <View style={styles.cardsSection}>
           <ThemedText style={[styles.cardsSectionTitle, styles.liquidGlassText, { color: '#7D5A50', fontSize: 22 }]}> 
          Schnellzugriff
        </ThemedText>

        <View style={styles.cardsGrid}>
          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => handleNavigate('/recipe-generator' as any)}
            activeOpacity={0.9}
          >
            <BlurView 
              {...androidBlurProps}
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(168, 196, 193, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(168, 196, 193, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="fork.knife" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>BLW-Rezepte</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Rezepte entdecken</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => handleNavigate('/(tabs)/baby')}
            activeOpacity={0.9}
          >
            <BlurView 
              {...androidBlurProps}
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 190, 190, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 140, 160, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="person.fill" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Mein Baby</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Alle Infos & Entwicklungen</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => handleNavigate('/planner')}
            activeOpacity={0.9}
          >
            <BlurView 
              {...androidBlurProps}
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(220, 200, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(200, 130, 220, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="calendar" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Planer</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Tagesplan & To‑dos</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => handleNavigate('/(tabs)/daily_old')}
            activeOpacity={0.9}
          >
            <BlurView 
              {...androidBlurProps}
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 215, 180, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 180, 130, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="list.bullet" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Unser Tag</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Tagesaktivitäten verwalten</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => handleNavigate('/(tabs)/selfcare')}
            activeOpacity={0.9}
          >
            <BlurView 
              {...androidBlurProps}
              intensity={24} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(255, 210, 230, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(255, 160, 180, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="heart.fill" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Mama Selfcare</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Nimm dir Zeit für dich</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.liquidGlassCardWrapper}
            onPress={() => handleNavigate('/(tabs)/babyweather')}
            activeOpacity={0.9}
          >
            <BlurView 
              {...androidBlurProps}
              intensity={16} 
              tint={colorScheme === 'dark' ? 'dark' : 'light'} 
              style={styles.liquidGlassCardBackground}
            >
              <View style={[styles.card, styles.liquidGlassCard, { backgroundColor: 'rgba(200, 225, 255, 0.6)', borderColor: 'rgba(255, 255, 255, 0.35)' }]}>
                <View style={[styles.iconContainer, { backgroundColor: 'rgba(140, 190, 255, 0.9)', borderRadius: 30, padding: 8, marginBottom: 10, borderWidth: 2, borderColor: 'rgba(255, 255, 255, 0.4)', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }]}>
                  <IconSymbol name="cloud.sun.fill" size={28} color="#FFFFFF" />
                </View>
                <ThemedText style={[styles.cardTitle, styles.liquidGlassCardTitle, { color: '#7D5A50', fontWeight: '700' }]}>Babywetter</ThemedText>
                <ThemedText style={[styles.cardDescription, styles.liquidGlassCardDescription, { color: '#7D5A50', fontWeight: '500' }]}>Aktuelle Wetterinfos</ThemedText>
              </View>
            </BlurView>
          </TouchableOpacity>
        </View>
      </View>
    );
  };

  return (
    <ThemedBackground style={styles.backgroundImage}>
      <SafeAreaView style={styles.container}>
      <StatusBar hidden={true} />
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={theme.accent} />
            <ThemedText style={styles.loadingText}>Lade deine persönliche Übersicht...</ThemedText>
          </View>
        ) : (
          <ScrollView 
            style={styles.scrollView} 
            contentContainerStyle={styles.contentContainer}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={['#7D5A50']}
                tintColor={theme.text}
                title="Aktualisiere..."
                titleColor={theme.text}
              />
            }
          >
            {renderGreetingSection()}
            {renderOverviewSection()}
            {renderQuickAccessCards()}
          </ScrollView>
        )}

        <ActivityInputModal
          visible={showInputModal}
          activityType={selectedActivityType}
          initialSubType={selectedSubType}
          date={new Date()}
          onClose={() => {
            setShowInputModal(false);
            setSelectedActivityType('feeding');
            setSelectedSubType(null);
          }}
          onSave={handleSaveEntry}
        />
        <SleepQuickAddModal
          visible={showSleepModal}
          initialStart={sleepModalStart}
          onClose={() => setShowSleepModal(false)}
          onSave={handleSaveSleepQuickEntry}
        />
      </SafeAreaView>
    </ThemedBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backgroundImage: {
    flex: 1,
    width: '100%',
    backgroundColor: '#f5eee0', // Beige Hintergrund wie im Bild
  },
  scrollView: {
    flex: 1,
  },
  contentContainer: {
    padding: 20,
    paddingBottom: 40,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
  },

  // Liquid Glass styles - Core Components
  liquidGlassWrapper: {
    position: 'relative',
    marginBottom: 16,
    borderRadius: 22,
    overflow: 'hidden',
  },
  greetingCardWrapper: {
    borderRadius: 30,
    overflow: 'hidden',
  },
  greetingGlassBackground: {
    borderRadius: 30,
  },
  greetingGlassContainer: {
    borderRadius: 30,
  },
  liquidGlassBackground: {
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: 'rgba(255, 255, 255, 0.35)', // stärkerer Frostglas-Effekt
  },
  liquidGlassContainer: {
    borderRadius: 22,
    backgroundColor: 'transparent',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 14,
    elevation: 8,
  },

  // Begrüßungsbereich - Liquid Glass Design
  greetingContainer: {
    paddingTop: 26,
    paddingHorizontal: 24,
    paddingBottom: 22,
    backgroundColor: 'transparent',
    position: 'relative',
  },
  greetingHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  greeting: {
    fontSize: 30,
    fontWeight: '700',
    marginBottom: 4,
    letterSpacing: -0.5,
    lineHeight: 36,
  },
  dateText: {
    fontSize: 19,
    opacity: 0.8,
    fontWeight: '700',
    letterSpacing: 0.2,
  },
  profileBadge: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  profileImageWrapper: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileImage: {
    width: '100%',
    height: '100%',
    borderRadius: 34,
  },
  profilePlaceholder: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: 'rgba(125, 90, 80, 0.65)',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.75)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileStatusDot: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#5E3DB3',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 3,
    elevation: 6,
  },
  greetingGloss: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: 30,
  },

  // Tip Container
  tipCard: {
    marginTop: 14,
    borderRadius: 20,
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
    padding: 14,
    overflow: 'hidden',
    shadowColor: '#5E3DB3',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 12,
    elevation: 4,
  },
  tipHighlightContainer: {
    ...StyleSheet.absoluteFillObject,
  },
  tipHighlightDot: {
    position: 'absolute',
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    shadowColor: '#FFFFFF',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
    elevation: 3,
  },
  tipHighlightDotOne: {
    width: 10,
    height: 10,
    borderRadius: 5,
    top: 10,
    right: 16,
  },
  tipHighlightDotTwo: {
    width: 6,
    height: 6,
    borderRadius: 3,
    top: 28,
    right: 44,
  },
  tipHighlightDotThree: {
    width: 8,
    height: 8,
    borderRadius: 4,
    bottom: 10,
    right: 28,
  },
  tipCardRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  tipIconWrap: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },
  tipContent: {
    flex: 1,
    marginLeft: 12,
  },
  tipLabel: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5E3DB3',
    marginBottom: 4,
  },
  tipText: {
    fontSize: 14,
    lineHeight: 19,
    fontWeight: '500',
    color: '#6B4C3B',
  },

  // Overview Carousel
  overviewCarouselWrapper: {
    marginBottom: 16,
  },
  overviewCarousel: {
    width: '100%',
  },
  overviewSlide: {
    width: '100%',
  },
  carouselCardWrapper: {
    marginBottom: 0,
    width: '100%',
  },
  carouselDots: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginTop: 10,
  },
  carouselDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(107, 76, 59, 0.25)',
    marginHorizontal: 4,
  },
  carouselDotActive: {
    backgroundColor: '#6B4C3B',
  },

  // Recommendation Card
  recommendationContainer: {
    flex: 1,
    padding: 18,
  },
  recommendationCard: {
    flex: 1,
    width: '100%',
    borderRadius: 20,
  },
  recommendationInnerCard: {
    flex: 1,
    borderRadius: 18,
    padding: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.55)',
  },
  recommendationRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  recommendationImagePane: {
    width: '40%',
    maxWidth: 120,
    maxHeight: 120,
    aspectRatio: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.75)',
    borderRadius: 10,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
  },
  recommendationImageFallback: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    width: '100%',
    height: '100%',
  },
  recommendationImage: {
    width: '100%',
    height: '100%',
    resizeMode: 'cover',
  },
  recommendationContentPane: {
    flex: 1,
    minWidth: 0,
    flexShrink: 1,
    paddingVertical: 4,
    justifyContent: 'space-between',
    backgroundColor: 'transparent',
  },
  recommendationTextWrap: {
    flex: 1,
    flexShrink: 1,
  },
  recommendationTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#6B4C3B',
    marginBottom: 4,
    letterSpacing: 0.2,
    flexWrap: 'wrap',
  },
  recommendationDescription: {
    fontSize: 13,
    fontWeight: '500',
    color: 'rgba(125, 90, 80, 0.88)',
    lineHeight: 18,
    flexWrap: 'wrap',
  },
  recommendationButton: {
    alignSelf: 'flex-end',
    marginTop: 8,
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 14,
    backgroundColor: '#5E3DB3',
    borderWidth: 1,
    borderColor: 'rgba(94, 61, 179, 0.7)',
  },
  recommendationButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  recommendationEmptyWrapper: {
    flex: 1,
  },
  recommendationHeaderSpacer: {
    opacity: 0,
  },
  recommendationEmpty: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  recommendationEmptyText: {
    fontSize: 13,
    color: '#7D5A50',
    marginTop: 8,
    textAlign: 'center',
  },


  // Tagesübersicht - Liquid Glass Design
  summaryContainer: {
    padding: 20,
    backgroundColor: 'transparent',
  },
  sectionTitleContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    letterSpacing: -0.3,
  },
  statsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  statItem: {
    alignItems: 'center',
    flex: 1,
    paddingVertical: 16,

  },
  statValue: {
    fontSize: 28,
    fontWeight: '800',
    marginVertical: 4,
    letterSpacing: -1,
  },
  statLabel: {
    fontSize: 13,
    textAlign: 'center',
    fontWeight: '600',
    opacity: 0.9,
  },

  // Enhanced Liquid Glass Text Styles
  liquidGlassText: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
  },
  liquidGlassSecondaryText: {
    color: 'rgba(255, 255, 255, 0.8)',
    fontWeight: '500',
  },

  // Stats with Liquid Glass Enhancement
  liquidGlassStatItem: {
    backgroundColor: 'rgba(255, 255, 255, 0.34)',
    borderRadius: 16,
    padding: 8,
    marginHorizontal: 4,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.4)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 10,
    elevation: 5,
    minHeight: 66,
    justifyContent: 'center',
    alignItems: 'center',
  },
  liquidGlassStatIcon: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
    borderRadius: 32,
    padding: 14,
    marginBottom: 6,
    alignSelf: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 6,
    width: 64,
    height: 64,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255, 255, 255, 0.9)',
  },
  statEmoji: {
    fontSize: 32,
    lineHeight: 34,
    textAlign: 'center',
  },
  liquidGlassStatValue: {
    color: 'rgba(255, 255, 255, 0.95)',
    fontSize: 24,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: -1,
    textShadowColor: 'rgba(0, 0, 0, 0.3)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 2,
    marginTop: 2,
    marginBottom: 2,
    lineHeight: 26,
  },
  liquidGlassStatLabel: {
    color: 'rgba(255, 255, 255, 0.85)',
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'center',
    marginTop: 4,
  },
  liquidGlassChevron: {
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 12,
    padding: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 3,
  },

  // Quick Access Cards Section
  cardsSection: {
    marginBottom: 16,
  },
  cardsSectionTitle: {
    fontSize: 20,
    fontWeight: '800',
    marginBottom: 16,
    textAlign: 'center',
    color: '#6B4C3B',
    letterSpacing: -0.3,
  },
  cardsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    alignItems: 'stretch',
  },

  // Liquid Glass Cards
  liquidGlassCardWrapper: {
    width: '48%',
    marginBottom: 14,
    borderRadius: 22,
    overflow: 'hidden',
  },
  liquidGlassCardBackground: {
    borderRadius: 22,
    overflow: 'hidden',
  },
  card: {
    borderRadius: 22,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 128,
    height: 140,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.25)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 5,
  },
  liquidGlassCard: {
    backgroundColor: 'transparent',
  },
  iconContainer: {
    width: 54,
    height: 54,
    borderRadius: 27,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 10,
  },
  liquidGlassIconContainer: {
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.6)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '800',
    marginBottom: 4,
    textAlign: 'center',
  },
  liquidGlassCardTitle: {
    color: 'rgba(85, 60, 55, 0.95)',
    fontWeight: '700',
    letterSpacing: -0.2,
  },
  cardDescription: {
    fontSize: 11,
    textAlign: 'center',
    lineHeight: 14,
  },
  liquidGlassCardDescription: {
    color: 'rgba(85, 60, 55, 0.7)',
    fontWeight: '500',
  },
});
