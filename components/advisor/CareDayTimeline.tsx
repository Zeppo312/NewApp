import React, { useEffect, useMemo, useState } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { ThemedText } from '@/components/ThemedText';
import { IconSymbol } from '@/components/ui/IconSymbol';
import { useLocale } from '@/contexts/LocaleContext';
import type { CareDayTimelineItem } from '@/lib/advisor/day-timeline';
import { translateAdvisor } from '@/lib/advisor/advisorTranslations';

type TimelineColors = {
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  accent: string;
  accentSurface: string;
  divider: string;
  skeleton: string;
  warning: string;
  warningSurface: string;
  isDark?: boolean;
};

type Props = {
  items: CareDayTimelineItem[];
  loading: boolean;
  colors: TimelineColors;
  onOpenPlanner: () => void;
};

const KIND_META: Record<
  CareDayTimelineItem['kind'],
  { emoji: string; color: string; colorDark: string }
> = {
  sleep: { emoji: '💤', color: '#6C5CE0', colorDark: '#B8ADFF' },
  feeding: { emoji: '🍼', color: '#DB6F9C', colorDark: '#F2A7C5' },
  planner: { emoji: '📅', color: '#3FA294', colorDark: '#83D4C8' },
  task: { emoji: '✓', color: '#D88A3C', colorDark: '#F1B778' },
};

function TimelineSkeleton({ color }: { color: string }) {
  const [opacity] = useState(() => new Animated.Value(0.42));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0.9, duration: 700, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0.42, duration: 700, useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [opacity]);

  return (
    <View style={styles.skeletonList}>
      {[0, 1, 2].map((index) => (
        <View key={index} style={styles.skeletonRow}>
          <Animated.View style={[styles.skeletonTime, { backgroundColor: color, opacity }]} />
          <Animated.View style={[styles.skeletonDot, { backgroundColor: color, opacity }]} />
          <View style={styles.skeletonText}>
            <Animated.View style={[styles.skeletonTitle, { backgroundColor: color, opacity }]} />
            <Animated.View style={[styles.skeletonSubtitle, { backgroundColor: color, opacity }]} />
          </View>
        </View>
      ))}
    </View>
  );
}

export function CareDayTimeline({ items, loading, colors, onOpenPlanner }: Props) {
  const { locale } = useLocale();
  const t = (key: Parameters<typeof translateAdvisor>[1], params?: Record<string, string | number>) =>
    translateAdvisor(locale, key, params);
  const hasPlannerItems = items.some((item) => item.kind === 'planner' || item.kind === 'task');
  const dynamicStyles = useMemo(
    () => ({
      title: { color: colors.textPrimary },
      subtitle: { color: colors.textSecondary },
      time: { color: colors.textTertiary },
      connector: { backgroundColor: colors.divider },
    }),
    [colors],
  );

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <View style={styles.headerCopy}>
          <View style={styles.titleRow}>
            <View style={[styles.headerIcon, { backgroundColor: colors.accentSurface }]}>
              <IconSymbol name="calendar" size={15} color={colors.accent} />
            </View>
            <ThemedText adaptive={false} style={[styles.heading, dynamicStyles.title]}>
              {t('timelineTitle')}
            </ThemedText>
          </View>
          <ThemedText adaptive={false} style={[styles.hint, dynamicStyles.subtitle]}>
            {t('timelineHint')}
          </ThemedText>
        </View>
        <TouchableOpacity
          activeOpacity={0.72}
          onPress={onOpenPlanner}
          accessibilityRole="button"
          accessibilityLabel={t('timelineOpenPlanner')}
          style={[styles.plannerButton, { backgroundColor: colors.accentSurface }]}
        >
          <IconSymbol name="arrow.up.right" size={13} color={colors.accent} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <TimelineSkeleton color={colors.skeleton} />
      ) : items.length === 0 ? (
        <View style={[styles.emptyState, { borderColor: colors.divider }]}>
          <Text style={styles.emptyEmoji}>✨</Text>
          <ThemedText adaptive={false} style={[styles.emptyText, dynamicStyles.subtitle]}>
            {t('timelineEmpty')}
          </ThemedText>
        </View>
      ) : (
        <View style={styles.list}>
          {items.map((item, index) => {
            const meta = KIND_META[item.kind];
            const kindColor = colors.isDark ? meta.colorDark : meta.color;
            const isLast = index === items.length - 1;
            return (
              <View key={item.id} style={styles.row}>
                <View style={styles.timeColumn}>
                  <ThemedText
                    adaptive={false}
                    numberOfLines={1}
                    style={[
                      styles.time,
                      dynamicStyles.time,
                      item.status === 'now' && { color: colors.accent },
                    ]}
                  >
                    {item.status === 'now' ? t('timelineNow') : item.timeLabel}
                  </ThemedText>
                </View>

                <View style={styles.rail}>
                  <View
                    style={[
                      styles.dot,
                      { borderColor: kindColor, backgroundColor: colors.accentSurface },
                      item.status === 'now' && { backgroundColor: kindColor },
                    ]}
                  >
                    <Text style={styles.dotEmoji}>{meta.emoji}</Text>
                  </View>
                  {!isLast ? <View style={[styles.connector, dynamicStyles.connector]} /> : null}
                </View>

                <View style={styles.body}>
                  <View style={styles.itemTitleRow}>
                    <ThemedText adaptive={false} style={[styles.itemTitle, dynamicStyles.title]}>
                      {item.title}
                    </ThemedText>
                    {item.isPredicted ? (
                      <View style={[styles.badge, { backgroundColor: colors.accentSurface }]}>
                        <Text style={[styles.badgeText, { color: colors.accent }]}>
                          {t('timelinePrediction')}
                        </Text>
                      </View>
                    ) : null}
                  </View>
                  {item.subtitle ? (
                    <ThemedText adaptive={false} style={[styles.itemSubtitle, dynamicStyles.subtitle]}>
                      {item.subtitle}
                    </ThemedText>
                  ) : null}
                  {item.conflictTitle ? (
                    <View style={[styles.conflict, { backgroundColor: colors.warningSurface }]}>
                      <IconSymbol name="exclamationmark.triangle" size={11} color={colors.warning} />
                      <Text style={[styles.conflictText, { color: colors.warning }]}>
                        {t('timelineConflict', { title: item.conflictTitle })}
                      </Text>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {hasPlannerItems ? (
        <TouchableOpacity activeOpacity={0.72} onPress={onOpenPlanner} style={styles.footerLink}>
          <Text style={[styles.footerLinkText, { color: colors.accent }]}>
            {t('timelineOpenPlanner')}
          </Text>
          <IconSymbol name="chevron.right" size={12} color={colors.accent} />
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: 17 },
  header: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
  headerCopy: { flex: 1, gap: 7 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  headerIcon: { width: 32, height: 32, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  heading: { fontSize: 17, fontWeight: '800', letterSpacing: -0.2 },
  hint: { fontSize: 12.5, lineHeight: 18, paddingLeft: 42 },
  plannerButton: { width: 34, height: 34, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  list: { gap: 0 },
  row: { flexDirection: 'row', alignItems: 'stretch', minHeight: 76 },
  timeColumn: { width: 76, paddingTop: 5, paddingRight: 10 },
  time: { fontSize: 11.5, fontWeight: '700', textAlign: 'right', fontVariant: ['tabular-nums'] },
  rail: { width: 34, alignItems: 'center' },
  dot: { width: 28, height: 28, borderRadius: 14, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', zIndex: 1 },
  dotEmoji: { fontSize: 12, fontWeight: '800' },
  connector: { position: 'absolute', top: 28, bottom: 0, width: StyleSheet.hairlineWidth },
  body: { flex: 1, paddingLeft: 8, paddingBottom: 18, gap: 5 },
  itemTitleRow: { flexDirection: 'row', alignItems: 'flex-start', flexWrap: 'wrap', gap: 7 },
  itemTitle: { flexShrink: 1, fontSize: 14.5, lineHeight: 19, fontWeight: '700' },
  itemSubtitle: { fontSize: 11.5, lineHeight: 16 },
  badge: { borderRadius: 999, paddingHorizontal: 7, paddingVertical: 3 },
  badgeText: { fontSize: 9.5, lineHeight: 12, fontWeight: '800', letterSpacing: 0.15 },
  conflict: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 5, borderRadius: 9, paddingHorizontal: 7, paddingVertical: 5 },
  conflictText: { flexShrink: 1, fontSize: 10.5, lineHeight: 14, fontWeight: '700' },
  emptyState: { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: StyleSheet.hairlineWidth, borderRadius: 16, padding: 14 },
  emptyEmoji: { fontSize: 17 },
  emptyText: { flex: 1, fontSize: 12.5, lineHeight: 18 },
  footerLink: { alignSelf: 'flex-end', flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 3 },
  footerLinkText: { fontSize: 12, fontWeight: '700' },
  skeletonList: { gap: 16 },
  skeletonRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  skeletonTime: { width: 58, height: 11, borderRadius: 6 },
  skeletonDot: { width: 28, height: 28, borderRadius: 14 },
  skeletonText: { flex: 1, gap: 7 },
  skeletonTitle: { width: '72%', height: 13, borderRadius: 7 },
  skeletonSubtitle: { width: '48%', height: 10, borderRadius: 5 },
});
