/**
 * WochenkarteStory — der Sonntags-Reveal.
 *
 * Vollbild-Story im Stil von „Wrapped": 5 durchtippbare Karten
 * (Wort der Woche → Momente-Count-up → Rekord-Tag → Herzen → Wochenkarte).
 * Die letzte Karte ist per ViewShot teilbar (WhatsApp, Oma & Opa).
 *
 * Navigation: Tap rechts = weiter, Tap links = zurück, X = schließen.
 * Ton bleibt soft — auch eine leere Woche bekommt eine liebevolle Story.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Animated,
  Easing,
  Image,
  Modal,
  Platform,
  Pressable,
  Share,
  StyleSheet,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { ThemedText } from '@/components/ThemedText';
import { babyImageForLevel } from '@/lib/lottiBabyImages';
import type { DayCounts, DayPointBreakdown, LottiLevelInfo } from '@/lib/lottiPoints';

const DAY_NAMES = [
  'Montag',
  'Dienstag',
  'Mittwoch',
  'Donnerstag',
  'Freitag',
  'Samstag',
  'Sonntag',
];
const DAY_SHORT_NAMES = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

const GRADIENTS: [string, string][] = [
  ['#4A2F94', '#8B6BD9'],
  ['#2F5F6D', '#7FB4B0'],
  ['#7A3E4B', '#D8897A'],
  ['#3B4B7D', '#80A6D9'],
  ['#5E3DB3', '#C89F81'],
];

export type WochenkarteData = {
  weekStart: Date;
  weekEnd: Date;
  counts: { feeding: number; care: number; sleep: number };
  activeDays: number;
  totalSleepMinutes: number;
  weekPoints: number;
  dayBuckets: DayCounts[];
  dayPoints: DayPointBreakdown[];
  level: LottiLevelInfo;
  totalPoints: number;
};

type Props = {
  visible: boolean;
  onClose: () => void;
  data: WochenkarteData;
};

const formatRange = (start: Date, end: Date) => {
  const dayMonth = (d: Date) =>
    `${d.getDate()}. ${d.toLocaleString('de-DE', { month: 'long' })}`;
  if (start.getMonth() === end.getMonth()) {
    return `${start.getDate()}.–${dayMonth(end)}`;
  }
  return `${dayMonth(start)} – ${dayMonth(end)}`;
};

/** „Wort der Woche" — abgeleitet aus dem dominanten Bereich. */
export function getWochenkarteMood(
  data: Pick<WochenkarteData, 'counts'>,
): { word: string; emoji: string } {
  const { feeding, care, sleep } = data.counts;
  const total = feeding + care + sleep;
  if (total === 0) return { word: 'Ruhig', emoji: '🕊️' };
  const max = Math.max(feeding, care, sleep);
  // Ausgeglichen, wenn kein Bereich klar dominiert
  if (max / total < 0.45 && feeding > 0 && care > 0 && sleep > 0) {
    return { word: 'Im Gleichgewicht', emoji: '✨' };
  }
  if (max === sleep) return { word: 'Verträumt', emoji: '🌙' };
  if (max === feeding) return { word: 'Genussvoll', emoji: '🍼' };
  return { word: 'Kuschelig', emoji: '🤍' };
}

function strongestDay(data: WochenkarteData): { name: string; points: number } | null {
  let bestIdx = -1;
  let best = 0;
  data.dayPoints.forEach((dp, idx) => {
    if (dp.total > best) {
      best = dp.total;
      bestIdx = idx;
    }
  });
  if (bestIdx === -1) return null;
  return { name: DAY_NAMES[bestIdx], points: best };
}

const formatSleep = (minutes: number) => {
  if (minutes <= 0) return null;
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  if (h <= 0) return `${m} Min`;
  if (m === 0) return `${h} Std`;
  return `${h} Std ${m} Min`;
};

export function WochenkarteStory({ visible, onClose, data }: Props) {
  const [page, setPage] = useState(0);
  const pageCount = 5;
  const viewShotRef = useRef<React.ElementRef<typeof ViewShot> | null>(null);

  const handleClose = () => {
    setPage(0);
    onClose();
  };

  const goNext = () => {
    if (page < pageCount - 1) {
      setPage(page + 1);
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
      }
    }
  };
  const goPrev = () => {
    if (page > 0) setPage(page - 1);
  };

  const handleShare = async () => {
    try {
      const uri = await viewShotRef.current?.capture?.();
      if (!uri) throw new Error('Konnte Wochenkarte nicht erfassen');
      if (Platform.OS === 'ios') {
        await Sharing.shareAsync(uri);
      } else {
        await Share.share({
          title: 'Unsere Lotti-Woche',
          message: `Unsere Woche mit Lotti: ${totalMoments} Momente, +${data.weekPoints} Herzen 🤍`,
          url: uri,
        });
      }
    } catch {
      Alert.alert(
        'Teilen nicht möglich',
        'Beim Teilen ist etwas schiefgegangen. Bitte versucht es später noch einmal.',
      );
    }
  };

  const totalMoments =
    data.counts.feeding + data.counts.care + data.counts.sleep;
  const word = useMemo(() => getWochenkarteMood(data), [data]);
  const record = useMemo(() => strongestDay(data), [data]);
  const sleepTotal = formatSleep(data.totalSleepMinutes);
  const rangeLabel = formatRange(data.weekStart, data.weekEnd);

  return (
    <Modal
      visible={visible}
      animationType="fade"
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <LinearGradient colors={GRADIENTS[page]} style={styles.root}>
        <StoryBackdrop page={page} />

        {/* Fortschrittsbalken */}
        <View style={styles.progressRow}>
          {Array.from({ length: pageCount }).map((_, i) => (
            <View
              key={i}
              style={[
                styles.progressSegment,
                {
                  backgroundColor:
                    i <= page ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.30)',
                },
              ]}
            />
          ))}
        </View>

        <Pressable onPress={handleClose} style={styles.closeButton} hitSlop={12}>
          <ThemedText adaptive={false} style={styles.closeText}>
            ✕
          </ThemedText>
        </Pressable>

        {/* Seiteninhalt — pointerEvents durchlässig, damit die Tap-Zonen
            darunter funktionieren; nur die letzte Seite hat eigene Buttons. */}
        <View
          style={styles.pageArea}
          pointerEvents={page === pageCount - 1 ? 'box-none' : 'none'}
        >
          {page === 0 ? (
            <StoryPage key="p0">
              <ThemedText adaptive={false} style={styles.kicker}>
                Eure Woche · {rangeLabel}
              </ThemedText>
              <HeroEmoji emoji={word.emoji} />
              <ThemedText adaptive={false} style={styles.heroWord}>
                {word.word}
              </ThemedText>
              <ThemedText adaptive={false} style={styles.pageBody}>
                {totalMoments === 0
                  ? 'Eine stille Woche — auch die gehört zu eurer Geschichte.'
                  : 'So hat sich eure Woche angefühlt. Tippt weiter für euren Rückblick.'}
              </ThemedText>
            </StoryPage>
          ) : null}

          {page === 1 ? (
            <StoryPage key="p1">
              <ThemedText adaptive={false} style={styles.kicker}>
                Festgehalten
              </ThemedText>
              <CountUpNumber value={totalMoments} />
              <ThemedText adaptive={false} style={styles.pageTitle}>
                {totalMoments === 1 ? 'Moment' : 'Momente'} diese Woche
              </ThemedText>
              <View style={styles.metricPillRow}>
                <MetricPill emoji="🍼" label="Essen" value={data.counts.feeding} />
                <MetricPill emoji="🤍" label="Pflege" value={data.counts.care} />
                <MetricPill emoji="🌙" label="Schlaf" value={data.counts.sleep} />
              </View>
            </StoryPage>
          ) : null}

          {page === 2 ? (
            <StoryPage key="p2">
              <ThemedText adaptive={false} style={styles.kicker}>
                Euer Rekord
              </ThemedText>
              <HeroEmoji emoji="⭐" compact />
              {record ? (
                <>
                  <ThemedText adaptive={false} style={styles.heroWord}>
                    {record.name}
                  </ThemedText>
                  <ThemedText adaptive={false} style={styles.pageBody}>
                    war euer stärkster Tag — +{record.points} Herzen an einem Tag.
                    {sleepTotal ? `\n\nInsgesamt hat Lotti ${sleepTotal} geschlafen. 🌙` : ''}
                  </ThemedText>
                  <DayPointsStrip dayPoints={data.dayPoints} />
                </>
              ) : (
                <>
                  <ThemedText adaptive={false} style={styles.heroWord}>
                    Nächste Woche
                  </ThemedText>
                  <ThemedText adaptive={false} style={styles.pageBody}>
                    wartet euer erster Rekord. Jeder kleine Moment zählt.
                  </ThemedText>
                </>
              )}
            </StoryPage>
          ) : null}

          {page === 3 ? (
            <StoryPage key="p3">
              <ThemedText adaptive={false} style={styles.kicker}>
                Eure Herzen
              </ThemedText>
              <HeroEmoji emoji="🤍" compact />
              <CountUpNumber value={data.weekPoints} prefix="+" />
              <ThemedText adaptive={false} style={styles.pageTitle}>
                Herzen gesammelt
              </ThemedText>
              <ThemedText adaptive={false} style={styles.pageBody}>
                Stufe {data.level.level} · {data.level.name}
                {data.level.nextLevelName
                  ? `\nNoch ${data.level.pointsToNext} Herzen bis „${data.level.nextLevelName}“`
                  : '\nHöchste Stufe erreicht 🤍'}
              </ThemedText>
            </StoryPage>
          ) : null}

          {page === 4 ? (
            <StoryPage key="p4" framed={false}>
              <ViewShot
                ref={viewShotRef}
                options={{ format: 'png', quality: 1 }}
                style={styles.cardShot}
              >
                <View style={styles.card}>
                  <View style={styles.cardHeader}>
                    <Image
                      source={babyImageForLevel(data.level.level)}
                      style={styles.cardAvatar}
                    />
                    <View style={styles.cardHeaderText}>
                      <ThemedText adaptive={false} style={styles.cardKicker}>
                        Unsere Lotti-Woche
                      </ThemedText>
                      <ThemedText adaptive={false} style={styles.cardRange}>
                        {rangeLabel}
                      </ThemedText>
                    </View>
                    <ThemedText adaptive={false} style={styles.cardWordEmoji}>
                      {word.emoji}
                    </ThemedText>
                  </View>

                  <ThemedText adaptive={false} style={styles.cardWord}>
                    „{word.word}“
                  </ThemedText>

                  <View style={styles.cardStatsRow}>
                    <CardStat value={String(totalMoments)} label="Momente" />
                    <CardStat value={`${data.activeDays}/7`} label="Tage" />
                    <CardStat value={`+${data.weekPoints}`} label="Herzen" />
                  </View>

                  <ThemedText adaptive={false} style={styles.cardFooter}>
                    Stufe {data.level.level} · {data.level.name} 🤍 Lotti Baby
                  </ThemedText>
                </View>
              </ViewShot>

              <Pressable
                onPress={handleShare}
                style={({ pressed }) => [
                  styles.shareButton,
                  { opacity: pressed ? 0.85 : 1 },
                ]}
              >
                <ThemedText adaptive={false} style={styles.shareButtonText}>
                  Wochenkarte teilen
                </ThemedText>
              </Pressable>
              <Pressable onPress={handleClose} hitSlop={8}>
                <ThemedText adaptive={false} style={styles.doneText}>
                  Fertig
                </ThemedText>
              </Pressable>
            </StoryPage>
          ) : null}
        </View>

        {/* Tap-Zonen: links zurück, rechts weiter (nicht auf letzter Seite) */}
        <View style={styles.tapRow} pointerEvents="box-none">
          <Pressable style={styles.tapLeft} onPress={goPrev} />
          {page < pageCount - 1 ? (
            <Pressable style={styles.tapRight} onPress={goNext} />
          ) : (
            <View style={styles.tapRight} pointerEvents="none" />
          )}
        </View>

        {page < pageCount - 1 ? (
          <ThemedText adaptive={false} style={styles.tapHint}>
            Tippen für weiter
          </ThemedText>
        ) : null}
      </LinearGradient>
    </Modal>
  );
}

/** Seite mit sanftem Fade/Slide-in. */
function StoryPage({
  children,
  framed = true,
}: {
  children: React.ReactNode;
  framed?: boolean;
}) {
  const anim = useMemo(() => new Animated.Value(0), []);
  useEffect(() => {
    Animated.timing(anim, {
      toValue: 1,
      duration: 450,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  }, [anim]);
  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.storyPage,
        framed ? styles.storyPanel : null,
        {
          opacity: anim,
          transform: [
            {
              translateY: anim.interpolate({
                inputRange: [0, 1],
                outputRange: [18, 0],
              }),
            },
          ],
        },
      ]}
    >
      {children}
    </Animated.View>
  );
}

function StoryBackdrop({ page }: { page: number }) {
  return (
    <View pointerEvents="none" style={styles.backdrop}>
      <View
        style={[
          styles.backdropBand,
          styles.backdropBandTop,
          page % 2 === 0 ? styles.backdropBandSoft : null,
        ]}
      />
      <View style={[styles.backdropBand, styles.backdropBandMiddle]} />
      <View style={[styles.backdropBand, styles.backdropBandBottom]} />
      <View style={styles.backdropGrid}>
        {Array.from({ length: 18 }).map((_, index) => (
          <View key={index} style={styles.backdropTick} />
        ))}
      </View>
    </View>
  );
}

function HeroEmoji({ emoji, compact = false }: { emoji: string; compact?: boolean }) {
  return (
    <View style={[styles.emojiFrame, compact ? styles.emojiFrameCompact : null]}>
      <View style={styles.emojiInnerRing}>
        <ThemedText
          adaptive={false}
          allowFontScaling={false}
          style={[styles.heroEmoji, compact ? styles.heroEmojiCompact : null]}
        >
          {emoji}
        </ThemedText>
      </View>
    </View>
  );
}

function MetricPill({
  emoji,
  label,
  value,
}: {
  emoji: string;
  label: string;
  value: number;
}) {
  return (
    <View style={styles.metricPill}>
      <ThemedText adaptive={false} allowFontScaling={false} style={styles.metricEmoji}>
        {emoji}
      </ThemedText>
      <ThemedText adaptive={false} style={styles.metricValue}>
        {value}
      </ThemedText>
      <ThemedText adaptive={false} style={styles.metricLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

function DayPointsStrip({ dayPoints }: { dayPoints: DayPointBreakdown[] }) {
  const max = Math.max(1, ...dayPoints.map((item) => item.total));
  return (
    <View style={styles.dayPointsStrip}>
      {DAY_SHORT_NAMES.map((label, index) => {
        const value = dayPoints[index]?.total ?? 0;
        const height = 10 + Math.round((value / max) * 42);
        return (
          <View key={label} style={styles.dayPointsItem}>
            <View style={styles.dayPointsBarTrack}>
              <View style={[styles.dayPointsBarFill, { height }]} />
            </View>
            <ThemedText adaptive={false} style={styles.dayPointsLabel}>
              {label}
            </ThemedText>
          </View>
        );
      })}
    </View>
  );
}

/** Große Zahl mit Count-up. */
function CountUpNumber({ value, prefix = '' }: { value: number; prefix?: string }) {
  const anim = useMemo(() => new Animated.Value(0), []);
  const [display, setDisplay] = useState(0);
  useEffect(() => {
    const id = anim.addListener(({ value: v }) => setDisplay(Math.round(v)));
    Animated.timing(anim, {
      toValue: value,
      duration: 1200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: false,
    }).start();
    return () => anim.removeListener(id);
  }, [anim, value]);
  return (
    <ThemedText adaptive={false} style={styles.heroNumber}>
      {prefix}
      {display}
    </ThemedText>
  );
}

function CardStat({ value, label }: { value: string; label: string }) {
  return (
    <View style={styles.cardStat}>
      <ThemedText adaptive={false} style={styles.cardStatValue}>
        {value}
      </ThemedText>
      <ThemedText adaptive={false} style={styles.cardStatLabel}>
        {label}
      </ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  progressRow: {
    flexDirection: 'row',
    gap: 5,
    paddingTop: Platform.OS === 'ios' ? 58 : 34,
    paddingHorizontal: 16,
  },
  progressSegment: {
    flex: 1,
    height: 3.5,
    borderRadius: 2,
  },
  closeButton: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 72 : 48,
    right: 18,
    zIndex: 20,
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  closeText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '800',
  },
  pageArea: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 32,
    zIndex: 5,
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    overflow: 'hidden',
  },
  backdropBand: {
    position: 'absolute',
    left: '-18%',
    width: '136%',
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.10)',
    transform: [{ rotate: '-13deg' }],
  },
  backdropBandTop: {
    top: 112,
    height: 94,
  },
  backdropBandMiddle: {
    top: '44%',
    height: 132,
    backgroundColor: 'rgba(255,255,255,0.07)',
  },
  backdropBandBottom: {
    bottom: 54,
    height: 78,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  backdropBandSoft: {
    opacity: 0.75,
  },
  backdropGrid: {
    position: 'absolute',
    left: 26,
    right: 26,
    bottom: 92,
    flexDirection: 'row',
    justifyContent: 'space-between',
    opacity: 0.24,
  },
  backdropTick: {
    width: 2,
    height: 16,
    borderRadius: 1,
    backgroundColor: '#FFFFFF',
  },
  storyPage: {
    alignItems: 'center',
    gap: 10,
  },
  storyPanel: {
    alignSelf: 'stretch',
    paddingHorizontal: 22,
    paddingVertical: 28,
    borderRadius: 30,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    backgroundColor: 'rgba(255,255,255,0.12)',
  },
  kicker: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  emojiFrame: {
    width: 136,
    height: 136,
    borderRadius: 68,
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 10,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.36)',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  emojiFrameCompact: {
    width: 104,
    height: 104,
    borderRadius: 52,
    marginVertical: 4,
  },
  emojiInnerRing: {
    width: '82%',
    height: '82%',
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  heroEmoji: {
    fontSize: 82,
    lineHeight: 94,
    textAlign: 'center',
    textShadowColor: 'rgba(0,0,0,0.22)',
    textShadowOffset: { width: 0, height: 3 },
    textShadowRadius: 8,
  },
  heroEmojiCompact: {
    fontSize: 62,
    lineHeight: 72,
  },
  heroWord: {
    color: '#FFFFFF',
    fontSize: 40,
    lineHeight: 46,
    fontWeight: '900',
    textAlign: 'center',
    letterSpacing: 0,
  },
  heroNumber: {
    color: '#FFFFFF',
    fontSize: 88,
    lineHeight: 96,
    fontWeight: '900',
    letterSpacing: 0,
    marginVertical: 4,
  },
  pageTitle: {
    color: '#FFFFFF',
    fontSize: 22,
    fontWeight: '800',
    textAlign: 'center',
  },
  pageBody: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 16,
    lineHeight: 24,
    fontWeight: '500',
    textAlign: 'center',
    marginTop: 6,
  },
  metricPillRow: {
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: 8,
    marginTop: 10,
  },
  metricPill: {
    flex: 1,
    minHeight: 86,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    paddingVertical: 10,
    backgroundColor: 'rgba(255,255,255,0.18)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.24)',
  },
  metricEmoji: {
    fontSize: 26,
    lineHeight: 32,
    marginBottom: 2,
  },
  metricValue: {
    color: '#FFFFFF',
    fontSize: 22,
    lineHeight: 27,
    fontWeight: '900',
    textAlign: 'center',
  },
  metricLabel: {
    color: 'rgba(255,255,255,0.76)',
    fontSize: 11.5,
    lineHeight: 15,
    fontWeight: '700',
    textAlign: 'center',
  },
  dayPointsStrip: {
    alignSelf: 'stretch',
    minHeight: 86,
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: 6,
    marginTop: 10,
    paddingHorizontal: 12,
    paddingTop: 12,
    paddingBottom: 10,
    borderRadius: 20,
    backgroundColor: 'rgba(255,255,255,0.15)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.22)',
  },
  dayPointsItem: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
  },
  dayPointsBarTrack: {
    height: 54,
    width: '100%',
    maxWidth: 18,
    borderRadius: 9,
    justifyContent: 'flex-end',
    overflow: 'hidden',
    backgroundColor: 'rgba(255,255,255,0.20)',
  },
  dayPointsBarFill: {
    width: '100%',
    borderRadius: 9,
    backgroundColor: 'rgba(255,255,255,0.92)',
  },
  dayPointsLabel: {
    color: 'rgba(255,255,255,0.78)',
    fontSize: 10.5,
    lineHeight: 13,
    fontWeight: '800',
    textAlign: 'center',
  },
  tapRow: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    flexDirection: 'row',
    zIndex: 1,
  },
  tapLeft: {
    flex: 1,
  },
  tapRight: {
    flex: 2,
  },
  tapHint: {
    position: 'absolute',
    bottom: 34,
    alignSelf: 'center',
    color: 'rgba(255,255,255,0.55)',
    fontSize: 12.5,
    fontWeight: '600',
  },

  // Wochenkarte (teilbar)
  cardShot: {
    alignSelf: 'stretch',
  },
  card: {
    alignSelf: 'stretch',
    borderRadius: 26,
    backgroundColor: '#FFFDF7',
    paddingHorizontal: 22,
    paddingVertical: 20,
    gap: 14,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.25,
    shadowRadius: 24,
    elevation: 8,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  cardAvatar: {
    width: 46,
    height: 46,
    borderRadius: 23,
    borderWidth: 2,
    borderColor: 'rgba(94,61,179,0.25)',
  },
  cardHeaderText: {
    flex: 1,
    minWidth: 0,
  },
  cardKicker: {
    color: '#5E3DB3',
    fontSize: 11,
    fontWeight: '900',
    letterSpacing: 0,
    textTransform: 'uppercase',
  },
  cardRange: {
    color: '#7D5A50',
    fontSize: 13,
    fontWeight: '600',
  },
  cardWordEmoji: {
    fontSize: 26,
  },
  cardWord: {
    color: '#5C4033',
    fontSize: 28,
    lineHeight: 34,
    fontWeight: '900',
    textAlign: 'center',
  },
  cardStatsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 4,
  },
  cardStat: {
    alignItems: 'center',
    gap: 2,
  },
  cardStatValue: {
    color: '#5E3DB3',
    fontSize: 22,
    fontWeight: '900',
  },
  cardStatLabel: {
    color: '#9C8178',
    fontSize: 12,
    fontWeight: '600',
  },
  cardFooter: {
    color: '#9C8178',
    fontSize: 11.5,
    fontWeight: '600',
    textAlign: 'center',
  },

  // Aktionen auf letzter Seite
  shareButton: {
    marginTop: 20,
    alignSelf: 'stretch',
    minHeight: 48,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    zIndex: 10,
  },
  shareButtonText: {
    color: '#5E3DB3',
    fontSize: 15,
    fontWeight: '800',
  },
  doneText: {
    marginTop: 14,
    color: 'rgba(255,255,255,0.85)',
    fontSize: 14,
    fontWeight: '700',
  },
});
