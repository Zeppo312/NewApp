import type { AppLocale } from '@/lib/localization';
import type { PlannerBlock, PlannerEvent, PlannerTodo } from '@/services/planner';

import { translateAdvisor } from './advisorTranslations';
import type { DailySignals } from './types';

export type CareDayTimelineKind = 'sleep' | 'feeding' | 'planner' | 'task';
export type CareDayTimelineStatus = 'now' | 'upcoming' | 'later';

export type CareDayTimelineItem = {
  id: string;
  kind: CareDayTimelineKind;
  title: string;
  subtitle: string | null;
  timeLabel: string;
  startAt: string | null;
  endAt: string | null;
  status: CareDayTimelineStatus;
  isPredicted: boolean;
  isAllDay: boolean;
  conflictTitle: string | null;
};

type TimelineDraft = Omit<CareDayTimelineItem, 'conflictTitle'> & {
  sortAt: number;
};

const MINUTE_MS = 60_000;
const MAX_TIMELINE_ITEMS = 9;

const validDate = (value: string | null | undefined): Date | null => {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
};

const isPlannerEvent = (item: PlannerTodo | PlannerEvent): item is PlannerEvent =>
  'start' in item;

const sameLocalDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const localDayEnd = (date: Date): Date => {
  const end = new Date(date);
  end.setHours(23, 59, 59, 999);
  return end;
};

const formatTime = (date: Date, locale: AppLocale): string =>
  date.toLocaleTimeString(
    locale === 'de' ? 'de-DE' : locale === 'es' ? 'es-ES' : 'en-US',
    { hour: '2-digit', minute: '2-digit' },
  );

const formatRange = (start: Date, end: Date, locale: AppLocale): string =>
  `${formatTime(start, locale)}–${formatTime(end, locale)}`;

const predictionSpread = (intervalMinutes: number): number =>
  Math.max(15, Math.min(30, Math.round(intervalMinutes * 0.12)));

const statusFor = (
  start: Date,
  end: Date,
  now: Date,
): CareDayTimelineStatus => {
  if (start <= now && end >= now) return 'now';
  return start.getTime() - now.getTime() <= 3 * 60 * MINUTE_MS
    ? 'upcoming'
    : 'later';
};

const addPrediction = ({
  drafts,
  id,
  kind,
  at,
  intervalMinutes,
  samples,
  now,
  locale,
}: {
  drafts: TimelineDraft[];
  id: string;
  kind: 'sleep' | 'feeding';
  at: Date;
  intervalMinutes: number;
  samples: number;
  now: Date;
  locale: AppLocale;
}) => {
  const spread = predictionSpread(intervalMinutes);
  const start = new Date(at.getTime() - spread * MINUTE_MS);
  const end = new Date(at.getTime() + spread * MINUTE_MS);
  if (end < new Date(now.getTime() - 30 * MINUTE_MS) || start > localDayEnd(now)) return;

  drafts.push({
    id,
    kind,
    title: translateAdvisor(locale, kind === 'sleep' ? 'timelineSleep' : 'timelineFeeding'),
    subtitle: translateAdvisor(locale, 'timelineBasedOn', { count: samples }),
    timeLabel: formatRange(start, end, locale),
    startAt: start.toISOString(),
    endAt: end.toISOString(),
    status: statusFor(start, end, now),
    isPredicted: true,
    isAllDay: false,
    sortAt: start.getTime(),
  });
};

const plannerDrafts = (
  blocks: PlannerBlock[],
  now: Date,
  locale: AppLocale,
): TimelineDraft[] => {
  const drafts: TimelineDraft[] = [];
  const seen = new Set<string>();
  const dayEnd = localDayEnd(now);

  for (const block of blocks) {
    for (const item of block.items) {
      if (seen.has(item.id)) continue;
      seen.add(item.id);

      if (isPlannerEvent(item)) {
        const start = validDate(item.start);
        if (!start) continue;
        const end = validDate(item.end) ?? new Date(start.getTime() + 30 * MINUTE_MS);
        if (end < now || start > dayEnd || (!sameLocalDay(start, now) && !item.isAllDay)) continue;

        const shownStart = item.isAllDay ? now : start;
        drafts.push({
          id: `planner:${item.id}`,
          kind: 'planner',
          title: item.title,
          subtitle: item.location?.trim() || null,
          timeLabel: item.isAllDay
            ? translateAdvisor(locale, 'timelineAllDay')
            : formatRange(start, end, locale),
          startAt: start.toISOString(),
          endAt: end.toISOString(),
          status: item.isAllDay ? 'upcoming' : statusFor(start, end, now),
          isPredicted: false,
          isAllDay: !!item.isAllDay,
          sortAt: shownStart.getTime(),
        });
        continue;
      }

      if (item.completed || item.entryType === 'note') continue;
      const due = validDate(item.dueAt);
      if (due && (due < now || due > dayEnd || !sameLocalDay(due, now))) continue;

      drafts.push({
        id: `task:${item.id}`,
        kind: 'task',
        title: item.title,
        subtitle: null,
        timeLabel: due
          ? formatTime(due, locale)
          : translateAdvisor(locale, 'timelineToday'),
        startAt: due?.toISOString() ?? null,
        endAt: due?.toISOString() ?? null,
        status: due ? statusFor(due, due, now) : 'later',
        isPredicted: false,
        isAllDay: !due,
        sortAt: due?.getTime() ?? dayEnd.getTime() - 1,
      });
    }
  }

  return drafts;
};

const overlaps = (left: TimelineDraft, right: TimelineDraft): boolean => {
  const leftStart = validDate(left.startAt);
  const leftEnd = validDate(left.endAt);
  const rightStart = validDate(right.startAt);
  const rightEnd = validDate(right.endAt);
  if (!leftStart || !leftEnd || !rightStart || !rightEnd) return false;
  return leftStart <= rightEnd && rightStart <= leftEnd;
};

/**
 * Verbindet persönliche Schlaf-/Fütterprognosen mit den noch offenen
 * Planer-Einträgen des aktuellen Tages. Prognosen bleiben bewusst konservativ:
 * Weitere Schlaffenster werden nur erzeugt, wenn sowohl Wach- als auch
 * Tagesschlafdauer durch mehrere persönliche Einträge gestützt sind.
 */
export const buildCareDayTimeline = ({
  signals,
  plannerBlocks,
  now = new Date(),
  locale = 'de',
}: {
  signals: DailySignals;
  plannerBlocks: PlannerBlock[];
  now?: Date;
  locale?: AppLocale;
}): CareDayTimelineItem[] => {
  const drafts = plannerDrafts(plannerBlocks, now, locale);
  const dayEnd = localDayEnd(now);

  if (signals.sleep.isSleepingNow) {
    const start = validDate(signals.sleep.currentSleepStartedAt);
    if (start) {
      drafts.push({
        id: 'sleep:current',
        kind: 'sleep',
        title: translateAdvisor(locale, 'timelineCurrentSleep'),
        subtitle: null,
        timeLabel: translateAdvisor(locale, 'timelineNow'),
        startAt: start.toISOString(),
        endAt: now.toISOString(),
        status: 'now',
        isPredicted: false,
        isAllDay: false,
        sortAt: now.getTime() - 1,
      });
    }
  } else if (
    signals.sleep.typicalWakeMinutes != null &&
    signals.sleep.wakeSampleCount >= 4
  ) {
    const lastSleepEnd = validDate(signals.sleep.lastSleepEndAt);
    if (lastSleepEnd) {
      const firstAt = new Date(
        lastSleepEnd.getTime() + signals.sleep.typicalWakeMinutes * MINUTE_MS,
      );
      addPrediction({
        drafts,
        id: 'sleep:1',
        kind: 'sleep',
        at: firstAt,
        intervalMinutes: signals.sleep.typicalWakeMinutes,
        samples: signals.sleep.wakeSampleCount,
        now,
        locale,
      });

      if (
        signals.sleep.typicalNapMinutes != null &&
        signals.sleep.napSampleCount >= 3
      ) {
        const secondAt = new Date(
          firstAt.getTime() +
            (signals.sleep.typicalNapMinutes + signals.sleep.typicalWakeMinutes) * MINUTE_MS,
        );
        if (secondAt <= dayEnd) {
          addPrediction({
            drafts,
            id: 'sleep:2',
            kind: 'sleep',
            at: secondAt,
            intervalMinutes: signals.sleep.typicalWakeMinutes,
            samples: Math.min(
              signals.sleep.wakeSampleCount,
              signals.sleep.napSampleCount,
            ),
            now,
            locale,
          });
        }
      }
    }
  }

  if (
    signals.feeding.typicalIntervalMinutes != null &&
    signals.feeding.intervalSampleCount >= 4
  ) {
    const lastFeeding = validDate(signals.feeding.lastFeedingAt);
    if (lastFeeding) {
      const interval = signals.feeding.typicalIntervalMinutes;
      let at = new Date(lastFeeding.getTime() + interval * MINUTE_MS);
      while (at.getTime() + predictionSpread(interval) * MINUTE_MS < now.getTime()) {
        at = new Date(at.getTime() + interval * MINUTE_MS);
      }
      for (let index = 1; index <= 3 && at <= dayEnd; index += 1) {
        addPrediction({
          drafts,
          id: `feeding:${index}`,
          kind: 'feeding',
          at,
          intervalMinutes: interval,
          samples: signals.feeding.intervalSampleCount,
          now,
          locale,
        });
        at = new Date(at.getTime() + interval * MINUTE_MS);
      }
    }
  }

  const plannerItems = drafts.filter((item) => item.kind === 'planner');
  return drafts
    .map<CareDayTimelineItem>((item) => {
      const conflict = item.isPredicted
        ? plannerItems.find((plannerItem) => overlaps(item, plannerItem))
        : null;
      return {
        id: item.id,
        kind: item.kind,
        title: item.title,
        subtitle: item.subtitle,
        timeLabel: item.timeLabel,
        startAt: item.startAt,
        endAt: item.endAt,
        status: item.status,
        isPredicted: item.isPredicted,
        isAllDay: item.isAllDay,
        conflictTitle: conflict?.title ?? null,
      };
    })
    .sort((left, right) => {
      if (left.status === 'now' && right.status !== 'now') return -1;
      if (right.status === 'now' && left.status !== 'now') return 1;
      const leftTime = validDate(left.startAt)?.getTime() ?? dayEnd.getTime();
      const rightTime = validDate(right.startAt)?.getTime() ?? dayEnd.getTime();
      return leftTime - rightTime;
    })
    .slice(0, MAX_TIMELINE_ITEMS);
};
