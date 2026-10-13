import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Image,
  NativeScrollEvent,
  NativeSyntheticEvent,
  Platform,
  ScrollView,
  StyleSheet,
  TouchableOpacity,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Defs, LinearGradient as SvgGradient, Stop } from 'react-native-svg';
import ViewShot, { CaptureOptions, ViewShotRef } from 'react-native-view-shot';
import * as Sharing from 'expo-sharing';
import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import CountdownTimer from '@/components/CountdownTimer';
import { LiquidGlassCard, GLASS_BORDER, GLASS_BORDER_DARK } from '@/constants/DesignGuide';
import { babySizeData } from '@/lib/baby-size-data';
import {
  CountdownLocale,
  CountdownTranslationKey,
  getCountdownFruitComparison,
  getCountdownLocaleTag,
  translateCountdownText,
} from '@/lib/countdownTranslations';

const TOTAL_PREGNANCY_DAYS = 280;
const PAGE_COUNT = 3;
const AUTO_ROTATE_MS = 3500;
const MS_PER_DAY = 1000 * 60 * 60 * 24;

const SHARE_CAPTURE_OPTIONS: CaptureOptions = Platform.select({
  ios: { format: 'jpg', quality: 0.92, result: 'tmpfile', useRenderInContext: true },
  default: { format: 'jpg', quality: 0.92, result: 'tmpfile' },
});

const SOFT_ORBS = [
  { x: -50, y: -60, size: 190, color: 'rgba(255,200,216,0.35)' },
  { x: 220, y: 250, size: 200, color: 'rgba(214,224,255,0.35)' },
];

const toLocalFileUrl = (uri: string) => (uri.startsWith('file://') ? uri : `file://${uri}`);

const fruitEmoji: Record<string, string> = {
  Mohnkorn: '🌱',
  Apfelkern: '🍎',
  Erbse: '🟢',
  Heidelbeere: '🫐',
  Himbeere: '🍇',
  Erdbeere: '🍓',
  Aprikose: '🍑',
  Limette: '🍋',
  Zwetschge: '🍑',
  Pfirsich: '🍑',
  Zitrone: '🍋',
  Orange: '🍊',
  Avocado: '🥑',
  Süßkartoffel: '🍠',
  Mango: '🥭',
  Papaya: '🍈',
  Aubergine: '🍆',
  Kürbis: '🎃',
  Honigmelone: '🍈',
  Wassermelone: '🍉',
};

const getFruitEmoji = (comparison: string) => {
  for (const [key, emoji] of Object.entries(fruitEmoji)) {
    if (comparison.includes(key)) return emoji;
  }
  return '👶';
};

type Props = {
  dueDate: Date | null;
  locale: CountdownLocale;
  isDark: boolean;
  textPrimary: string;
  textSecondary: string;
  accent: string;
  glassOverlay: string;
  cardStyle: object;
  disabled?: boolean;
};

export default function PregnancyHeroCarousel({
  dueDate,
  locale,
  isDark,
  textPrimary,
  textSecondary,
  accent,
  glassOverlay,
  cardStyle,
  disabled,
}: Props) {
  const t = (key: CountdownTranslationKey, params?: Record<string, string | number>) =>
    translateCountdownText(locale, key, params);
  const localeTag = getCountdownLocaleTag(locale);
  const [pageWidth, setPageWidth] = useState(0);
  const [page, setPage] = useState(0);
  const [sharing, setSharing] = useState(false);
  const pagerRef = useRef<ScrollView | null>(null);
  const shareCardRef = useRef<ViewShotRef>(null);
  const pageRef = useRef(0);
  const [autoRotate, setAutoRotate] = useState(true);

  useEffect(() => {
    pageRef.current = page;
  }, [page]);

  // Rondell dreht alle 3,5 s weiter, bis der Nutzer selbst eingreift.
  useEffect(() => {
    if (!autoRotate || !pageWidth || sharing) return;
    const interval = setInterval(() => {
      const next = (pageRef.current + 1) % PAGE_COUNT;
      pagerRef.current?.scrollTo({ x: next * pageWidth, animated: true });
      setPage(next);
    }, AUTO_ROTATE_MS);
    return () => clearInterval(interval);
  }, [autoRotate, pageWidth, sharing]);

  const stopAutoRotate = () => {
    if (autoRotate) setAutoRotate(false);
  };

  const stats = useMemo(() => {
    if (!dueDate) return null;
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const due = new Date(dueDate);
    due.setHours(0, 0, 0, 0);
    const daysLeft = Math.round((due.getTime() - now.getTime()) / MS_PER_DAY);
    const daysRemaining = Math.max(0, daysLeft);
    const daysPregnant = Math.min(TOTAL_PREGNANCY_DAYS, Math.max(0, TOTAL_PREGNANCY_DAYS - daysRemaining));
    const weeksPregnant = Math.floor(daysPregnant / 7);
    const currentWeek = Math.min(40, weeksPregnant + 1);
    const currentDay = daysPregnant % 7;
    const progress = Math.min(1, Math.max(0, daysPregnant / TOTAL_PREGNANCY_DAYS));
    const trimester: 1 | 2 | 3 = currentWeek >= 28 ? 3 : currentWeek >= 14 ? 2 : 1;
    const pregnancyMonth = Math.max(1, Math.ceil(currentWeek / 4));
    const sizeData = babySizeData.find((d) => d.week === currentWeek) ?? null;
    return {
      daysLeft,
      daysRemaining,
      daysPregnant,
      currentWeek,
      currentDay,
      progress,
      trimester,
      pregnancyMonth,
      isOverdue: daysLeft < 0,
      sizeData,
    };
  }, [dueDate]);

  const glassBorder = isDark ? GLASS_BORDER_DARK : GLASS_BORDER;
  const tileBg = isDark ? 'rgba(0,0,0,0.22)' : 'rgba(255,255,255,0.28)';
  const tileStyle = { borderColor: glassBorder, backgroundColor: tileBg };

  const goToPage = (index: number) => {
    if (!pageWidth) return;
    stopAutoRotate();
    pagerRef.current?.scrollTo({ x: index * pageWidth, animated: true });
    setPage(index);
  };

  const handleScrollEnd = (event: NativeSyntheticEvent<NativeScrollEvent>) => {
    if (!pageWidth) return;
    const next = Math.round(event.nativeEvent.contentOffset.x / pageWidth);
    if (next !== page) setPage(next);
  };

  const handleShare = async () => {
    if (sharing || !stats) return;
    stopAutoRotate();
    setSharing(true);
    let capturedUri: string | null = null;
    try {
      const available = await Sharing.isAvailableAsync();
      if (!available) {
        Alert.alert(t('share.unavailableTitle'), t('share.unavailableBody'));
        return;
      }
      capturedUri = (await shareCardRef.current?.capture?.()) ?? null;
      if (!capturedUri) throw new Error('capture failed');
      await Sharing.shareAsync(toLocalFileUrl(capturedUri), {
        dialogTitle: t('share.dialogTitle'),
        mimeType: 'image/jpeg',
        UTI: 'public.jpeg',
      });
    } catch (error) {
      console.error('Failed to share pregnancy card:', error);
      Alert.alert(t('share.failedTitle'), t('share.failedBody'));
    } finally {
      if (capturedUri) ViewShot.releaseCapture(capturedUri);
      setSharing(false);
    }
  };

  const trimesterLabel = stats
    ? t(stats.trimester === 1 ? 'timer.trimesterOne' : stats.trimester === 2 ? 'timer.trimesterTwo' : 'timer.trimesterThree')
    : '';

  const statTiles = stats
    ? [
        {
          key: 'week',
          label: t('stats.week'),
          value: t('stats.weekValue', { week: stats.currentWeek }),
          icon: 'calendar' as const,
          tint: isDark ? 'rgba(236,224,255,0.25)' : 'rgba(236,224,255,0.85)',
          iconColor: '#7A6FD1',
        },
        {
          key: 'day',
          label: t('stats.weekDay'),
          value: t(stats.currentDay === 1 ? 'stats.day.one' : 'stats.day.other', { count: stats.currentDay }),
          icon: 'sun.max.fill' as const,
          tint: isDark ? 'rgba(255,223,209,0.25)' : 'rgba(255,223,209,0.85)',
          iconColor: '#C17055',
        },
        {
          key: 'trimester',
          label: t('stats.trimester'),
          value: trimesterLabel,
          icon: 'sparkles' as const,
          tint: isDark ? 'rgba(255,218,230,0.25)' : 'rgba(255,218,230,0.85)',
          iconColor: '#CF6F8B',
        },
        {
          key: 'month',
          label: t('stats.month'),
          value: t('stats.monthValue', { month: stats.pregnancyMonth }),
          icon: 'moon.stars.fill' as const,
          tint: isDark ? 'rgba(222,238,255,0.25)' : 'rgba(222,238,255,0.85)',
          iconColor: '#6C87C1',
        },
      ]
    : [];

  const ringSize = 132;
  const ringStroke = 11;
  const ringRadius = (ringSize - ringStroke) / 2;
  const ringCircumference = ringRadius * 2 * Math.PI;
  const progressPercent = stats
    ? (stats.progress * 100).toLocaleString(localeTag, { maximumFractionDigits: 0 })
    : '0';

  const pageTitles: CountdownTranslationKey[] = ['carousel.countdown', 'carousel.stats', 'carousel.share'];

  const shareFruit = stats?.sizeData
    ? getCountdownFruitComparison(locale, stats.sizeData.fruitComparison)
    : null;

  return (
    <LiquidGlassCard style={cardStyle} intensity={30} overlayColor={glassOverlay}>
      <View style={styles.heroHeader}>
        <View style={styles.heroCopy}>
          <ThemedText style={[styles.heroEyebrow, { color: accent }]}>{t('hero.eyebrow')}</ThemedText>
          <ThemedText style={[styles.heroTitle, { color: textPrimary }]}>
            {stats
              ? t('hero.week', { week: Math.max(0, stats.currentWeek - 1), day: stats.currentDay })
              : t('hero.waiting')}
          </ThemedText>
        </View>
        <View style={[styles.heroIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(142,78,198,0.12)' }]}>
          <IconSymbol name="heart.fill" size={20} color={accent} />
        </View>
      </View>

      <View style={styles.pagerWrap} onLayout={(e) => setPageWidth(e.nativeEvent.layout.width)}>
        {pageWidth > 0 && (
          <ScrollView
            ref={pagerRef}
            horizontal
            pagingEnabled
            showsHorizontalScrollIndicator={false}
            onMomentumScrollEnd={handleScrollEnd}
            onScrollBeginDrag={stopAutoRotate}
            scrollEventThrottle={16}
            nestedScrollEnabled
          >
            {/* Seite 1: Countdown */}
            <View style={{ width: pageWidth }}>
              <CountdownTimer
                dueDate={dueDate}
                variant="embedded"
                locale={locale}
                onPressRing={() => goToPage(1)}
              />
            </View>

            {/* Seite 2: Fortschritt & Stats */}
            <View style={[styles.page, { width: pageWidth }]}>
              {stats ? (
                <>
                  <View style={[styles.progressPanel, tileStyle]}>
                    <View style={styles.ringWrap}>
                      <Svg width={ringSize} height={ringSize} viewBox={`0 0 ${ringSize} ${ringSize}`}>
                        <Defs>
                          <SvgGradient id="heroStatsGradient" x1="0" y1="0" x2={String(ringSize)} y2={String(ringSize)} gradientUnits="userSpaceOnUse">
                            <Stop offset="0%" stopColor={isDark ? '#C9B3E8' : '#E6D8F7'} />
                            <Stop offset="100%" stopColor={accent} />
                          </SvgGradient>
                        </Defs>
                        <Circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={ringRadius}
                          stroke={isDark ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.6)'}
                          strokeWidth={ringStroke}
                          fill="none"
                        />
                        <Circle
                          cx={ringSize / 2}
                          cy={ringSize / 2}
                          r={ringRadius}
                          stroke="url(#heroStatsGradient)"
                          strokeWidth={ringStroke}
                          strokeDasharray={`${ringCircumference} ${ringCircumference}`}
                          strokeDashoffset={ringCircumference * (1 - stats.progress)}
                          strokeLinecap="round"
                          fill="none"
                          transform={`rotate(-90, ${ringSize / 2}, ${ringSize / 2})`}
                        />
                      </Svg>
                      <View style={styles.ringCenter}>
                        <ThemedText style={[styles.ringValue, { color: textPrimary }]}>{progressPercent}%</ThemedText>
                        <ThemedText style={[styles.ringLabel, { color: textSecondary }]}>{t('timer.complete')}</ThemedText>
                      </View>
                    </View>
                    <View style={styles.progressCopy}>
                      <ThemedText style={[styles.progressHeadline, { color: textPrimary }]}>{t('stats.journey')}</ThemedText>
                      <ThemedText style={[styles.progressLine, { color: textSecondary }]}>
                        {stats.isOverdue
                          ? t(Math.abs(stats.daysLeft) === 1 ? 'timer.daysOverdue.one' : 'timer.daysOverdue.other', { days: Math.abs(stats.daysLeft) })
                          : t('stats.daysLeft', { count: stats.daysRemaining })}
                      </ThemedText>
                      <ThemedText style={[styles.progressLine, { color: textSecondary }]}>
                        {t('stats.daysPregnant', { count: stats.daysPregnant })}
                      </ThemedText>
                    </View>
                  </View>

                  <View style={styles.statGrid}>
                    {statTiles.map((tile) => (
                      <View key={tile.key} style={[styles.statTile, tileStyle]}>
                        <LinearGradient
                          colors={[tile.tint, 'rgba(255,255,255,0.04)']}
                          start={{ x: 0, y: 0 }}
                          end={{ x: 1, y: 1 }}
                          style={StyleSheet.absoluteFill}
                        />
                        <View style={[styles.statIcon, { backgroundColor: isDark ? 'rgba(255,255,255,0.14)' : 'rgba(255,255,255,0.8)' }]}>
                          <IconSymbol name={tile.icon} size={16} color={tile.iconColor} />
                        </View>
                        <ThemedText style={[styles.statValue, { color: textPrimary }]}>{tile.value}</ThemedText>
                        <ThemedText style={[styles.statLabel, { color: textSecondary }]}>{tile.label}</ThemedText>
                      </View>
                    ))}
                  </View>
                </>
              ) : (
                <ThemedText style={[styles.emptyText, { color: textSecondary }]}>{t('timer.noDate')}</ThemedText>
              )}
            </View>

            {/* Seite 3: Teilen-Karte */}
            <View style={[styles.page, { width: pageWidth }]}>
              {stats && dueDate ? (
                <>
                  <View style={styles.shareFrame}>
                    <ViewShot ref={shareCardRef} style={styles.shareCard} options={SHARE_CAPTURE_OPTIONS}>
                      <LinearGradient
                        colors={['#FBEFE9', '#F7EEF6']}
                        start={{ x: 0, y: 0 }}
                        end={{ x: 0, y: 1 }}
                        style={styles.shareBackground}
                      />
                      {SOFT_ORBS.map((orb, index) => (
                        <View
                          key={`orb-${index}`}
                          style={[
                            styles.softOrb,
                            { left: orb.x, top: orb.y, width: orb.size, height: orb.size, borderRadius: orb.size / 2, backgroundColor: orb.color },
                          ]}
                        />
                      ))}

                      <View style={styles.shareInner}>
                        <ThemedText adaptive={false} style={styles.shareTitle}>{t('share.title')}</ThemedText>

                        <View style={styles.shareBadgeWrap}>
                          <View style={styles.shareBadgeRing}>
                            <View style={styles.shareBadge}>
                              {stats.sizeData?.imageUrl ? (
                                <Image source={{ uri: stats.sizeData.imageUrl }} style={styles.shareImage} resizeMode="contain" />
                              ) : (
                                <ThemedText adaptive={false} style={styles.shareEmoji}>
                                  {getFruitEmoji(stats.sizeData?.fruitComparison ?? '')}
                                </ThemedText>
                              )}
                            </View>
                          </View>
                          <View style={styles.shareWeekTag}>
                            <ThemedText adaptive={false} style={styles.shareWeekTagText}>
                              {t('hero.week', { week: Math.max(0, stats.currentWeek - 1), day: stats.currentDay })}
                            </ThemedText>
                          </View>
                        </View>

                        <ThemedText adaptive={false} style={styles.shareHeadline}>
                          {shareFruit
                            ? t('share.sizeLine', { comparison: shareFruit })
                            : t('share.growingLine')}
                        </ThemedText>
                        {stats.sizeData ? (
                          <ThemedText adaptive={false} style={styles.shareMeta}>
                            {t('babySize.meta', { length: stats.sizeData.length, weight: stats.sizeData.weight })}
                          </ThemedText>
                        ) : null}

                        <View style={styles.shareProgressTrack}>
                          <LinearGradient
                            colors={['#F5B7CA', '#C89BE8']}
                            start={{ x: 0, y: 0 }}
                            end={{ x: 1, y: 0 }}
                            style={[styles.shareProgressFill, { width: `${Math.max(3, Math.round(stats.progress * 100))}%` }]}
                          />
                        </View>

                        <View style={styles.shareInfoBox}>
                          <View style={styles.shareSheen} />
                          <View style={styles.shareInfoCol}>
                            <ThemedText adaptive={false} style={styles.shareInfoValue}>
                              {stats.isOverdue ? `+${Math.abs(stats.daysLeft)}` : stats.daysRemaining}
                            </ThemedText>
                            <ThemedText adaptive={false} style={styles.shareInfoLabel}>
                              {stats.isOverdue ? t('share.daysOverdue') : t('share.daysLeft')}
                            </ThemedText>
                          </View>
                          <View style={styles.shareInfoDivider} />
                          <View style={styles.shareInfoCol}>
                            <ThemedText adaptive={false} style={styles.shareInfoValue}>
                              {dueDate.toLocaleDateString(localeTag, { day: '2-digit', month: 'short' })}
                            </ThemedText>
                            <ThemedText adaptive={false} style={styles.shareInfoLabel}>{t('share.dueDate')}</ThemedText>
                          </View>
                          <View style={styles.shareInfoDivider} />
                          <View style={styles.shareInfoCol}>
                            <ThemedText adaptive={false} style={styles.shareInfoValue}>{progressPercent} %</ThemedText>
                            <ThemedText adaptive={false} style={styles.shareInfoLabel}>{t('timer.complete')}</ThemedText>
                          </View>
                        </View>

                        <ThemedText adaptive={false} style={styles.shareFooter}>{t('share.footer')}</ThemedText>
                      </View>
                    </ViewShot>
                  </View>

                  <TouchableOpacity
                    onPress={handleShare}
                    disabled={sharing || disabled}
                    activeOpacity={0.85}
                    style={[styles.shareButton, { backgroundColor: accent }, (sharing || disabled) && styles.shareButtonDisabled]}
                    accessibilityRole="button"
                    accessibilityLabel={t('share.button')}
                  >
                    <IconSymbol name="square.and.arrow.up" size={18} color="#fff" />
                    <ThemedText adaptive={false} style={styles.shareButtonText}>
                      {sharing ? t('share.sharing') : t('share.button')}
                    </ThemedText>
                  </TouchableOpacity>
                </>
              ) : (
                <ThemedText style={[styles.emptyText, { color: textSecondary }]}>{t('timer.noDate')}</ThemedText>
              )}
            </View>
          </ScrollView>
        )}
      </View>

      <View style={styles.dots}>
        {pageTitles.map((title, index) => (
          <TouchableOpacity
            key={title}
            onPress={() => goToPage(index)}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t(title)}
            style={[
              styles.dot,
              { backgroundColor: index === page ? accent : isDark ? 'rgba(255,255,255,0.3)' : 'rgba(125,90,80,0.25)' },
              index === page && styles.dotActive,
            ]}
          />
        ))}
      </View>
    </LiquidGlassCard>
  );
}

const styles = StyleSheet.create({
  heroHeader: {
    width: '100%',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 24,
    paddingTop: 20,
  },
  heroCopy: { flex: 1 },
  heroEyebrow: { fontSize: 11, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 },
  heroTitle: { fontSize: 21, lineHeight: 26, fontWeight: '800' },
  heroIcon: { width: 42, height: 42, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
  pagerWrap: { width: '100%' },
  page: { paddingHorizontal: 20, paddingTop: 20, paddingBottom: 8 },
  emptyText: { fontSize: 14, textAlign: 'center', paddingVertical: 40 },

  // Stats
  progressPanel: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 20,
    borderWidth: 1,
    padding: 16,
    gap: 14,
    marginBottom: 12,
  },
  ringWrap: { width: 132, height: 132, alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  ringValue: { fontSize: 24, fontWeight: '800' },
  ringLabel: { fontSize: 11, opacity: 0.8, marginTop: 2 },
  progressCopy: { flex: 1, minWidth: 0 },
  progressHeadline: { fontSize: 17, fontWeight: '700', marginBottom: 6 },
  progressLine: { fontSize: 13, lineHeight: 19, opacity: 0.9 },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  statTile: {
    width: '48.5%',
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
    paddingVertical: 12,
    paddingHorizontal: 8,
    marginBottom: 8,
    alignItems: 'center',
  },
  statIcon: { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center', marginBottom: 6 },
  statValue: { fontSize: 15, fontWeight: '700', textAlign: 'center' },
  statLabel: { fontSize: 11, opacity: 0.8, textAlign: 'center', marginTop: 2 },

  // Share
  shareFrame: {
    width: '100%',
    borderRadius: 24,
    borderCurve: 'continuous',
    overflow: 'hidden',
    boxShadow: '0 8px 24px rgba(78,52,39,0.14)',
  },
  shareCard: {
    width: '100%',
    overflow: 'hidden',
    backgroundColor: '#FBEFE9',
  },
  shareBackground: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  softOrb: { position: 'absolute' },
  shareTitle: {
    fontSize: 12,
    lineHeight: 16,
    fontWeight: '800',
    letterSpacing: 1.8,
    color: '#A9708C',
    textTransform: 'uppercase',
    marginBottom: 16,
  },
  shareProgressTrack: {
    alignSelf: 'stretch',
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
    marginTop: 16,
  },
  shareProgressFill: { height: '100%', borderRadius: 4 },
  shareSheen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '50%',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  shareInner: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 22,
    paddingBottom: 18,
  },
  shareBadgeWrap: { alignItems: 'center', marginBottom: 22 },
  shareBadgeRing: {
    width: 118,
    height: 118,
    borderRadius: 59,
    backgroundColor: 'rgba(255,255,255,0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    boxShadow: '0 8px 20px rgba(169,112,140,0.16)',
  },
  shareBadge: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,255,255,0.85)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  shareImage: { width: 80, height: 80 },
  shareEmoji: { fontSize: 44, lineHeight: 56 },
  shareWeekTag: {
    position: 'absolute',
    bottom: -12,
    backgroundColor: '#C98FB0',
    paddingHorizontal: 14,
    paddingVertical: 4,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.9)',
  },
  shareWeekTagText: { color: '#FFFFFF', fontSize: 13, lineHeight: 17, fontWeight: '800', letterSpacing: 0.4 },
  shareHeadline: { fontSize: 19, lineHeight: 25, fontWeight: '800', color: '#5C4033', textAlign: 'center', marginTop: 2 },
  shareMeta: { fontSize: 13, lineHeight: 17, fontWeight: '600', color: '#7D5A50', marginTop: 4, opacity: 0.85 },
  shareInfoBox: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'stretch',
    backgroundColor: 'rgba(255,255,255,0.5)',
    borderRadius: 18,
    paddingVertical: 12,
    paddingHorizontal: 6,
    marginTop: 12,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.9)',
    overflow: 'hidden',
  },
  shareInfoCol: { flex: 1, alignItems: 'center', gap: 2 },
  shareInfoValue: { fontSize: 18, lineHeight: 22, fontWeight: '800', color: '#5C4033' },
  shareInfoLabel: { fontSize: 11, lineHeight: 14, fontWeight: '600', color: '#7D5A50', textAlign: 'center' },
  shareInfoDivider: { width: 1, height: 30, backgroundColor: 'rgba(92,64,51,0.1)' },
  shareFooter: { fontSize: 11, lineHeight: 14, color: '#A9708C', fontWeight: '700', textAlign: 'center', marginTop: 16 },
  shareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    borderRadius: 18,
    paddingVertical: 14,
    marginTop: 14,
  },
  shareButtonDisabled: { opacity: 0.6 },
  shareButtonText: { color: '#fff', fontSize: 15, fontWeight: '800' },

  // Dots
  dots: { flexDirection: 'row', justifyContent: 'center', gap: 8, paddingVertical: 14 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  dotActive: { width: 22 },
});
