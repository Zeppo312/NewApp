import { buildCareDayTimeline } from '../advisor/day-timeline';
import type { DailySignals } from '../advisor/types';
import type { PlannerBlock } from '../../services/planner';

const makeSignals = (now: Date): DailySignals => ({
  babyName: 'Lotti',
  ageMonths: 6,
  ageText: '6 Monate alt',
  feeding: {
    totalCount: 2,
    bottleCount: 2,
    breastCount: 0,
    solidsCount: 0,
    waterCount: 0,
    totalBottleMl: 240,
    summaryText: 'Flasche 2×',
    isReal: true,
    lastFeedingAt: new Date(2026, 7, 3, 8, 0).toISOString(),
    hoursSinceLastFeeding: 2,
    lastBreastAt: null,
    daysSinceLastBreast: null,
    breastCountLast21Days: 0,
    bottleCountLast21Days: 20,
    solidsCountLast21Days: 0,
    likelyFeedingMode: 'bottle',
    typicalPerDay: 7,
    typicalByNow: 2,
    baselineSampleDays: 7,
    typicalIntervalMinutes: 120,
    intervalSampleCount: 12,
  },
  diaper: { count: 2, isReal: true, wetCountToday: 2, lastWetAt: null },
  sleep: {
    minutes: 90,
    text: '1 Std 30 Min',
    isReal: true,
    typicalMinutesByNow: 80,
    baselineSampleDays: 7,
    lastSleepEndAt: new Date(2026, 7, 3, 8, 30).toISOString(),
    currentSleepStartedAt: null,
    isSleepingNow: false,
    currentAwakeMinutes: 90,
    typicalWakeMinutes: 120,
    wakeSampleCount: 10,
    typicalNapMinutes: 60,
    napSampleCount: 8,
    lastNightMinutes: 500,
    typicalNightMinutes: 510,
    nightSampleDays: 6,
    roughNight: false,
  },
  context: { localHour: now.getHours(), localMinute: now.getMinutes() },
  weather: {
    available: false,
    temperature: null,
    feelsLike: null,
    description: '',
    isHot: false,
    isCold: false,
    isReal: true,
    uvIndex: null,
    rainProbability: null,
    isHighUv: false,
    isRainy: false,
  },
});

const plannerBlocks = (): PlannerBlock[] => [
  {
    id: 'morning',
    label: 'Vormittag',
    start: new Date(2026, 7, 3, 8, 0).toISOString(),
    end: new Date(2026, 7, 3, 12, 0).toISOString(),
    items: [
      {
        id: 'doctor',
        title: 'Kinderarzt',
        start: new Date(2026, 7, 3, 10, 20).toISOString(),
        end: new Date(2026, 7, 3, 11, 0).toISOString(),
        location: 'Praxis',
      },
      {
        id: 'done',
        title: 'Schon erledigt',
        completed: true,
        dueAt: new Date(2026, 7, 3, 11, 30).toISOString(),
        entryType: 'todo',
      },
    ],
  },
];

describe('care day timeline', () => {
  it('combines multiple personal predictions with upcoming planner entries', () => {
    const now = new Date(2026, 7, 3, 10, 0);
    const timeline = buildCareDayTimeline({
      signals: makeSignals(now),
      plannerBlocks: plannerBlocks(),
      now,
      locale: 'de',
    });

    expect(timeline.some((item) => item.id === 'planner:doctor')).toBe(true);
    expect(timeline.filter((item) => item.kind === 'feeding')).toHaveLength(3);
    expect(timeline.filter((item) => item.kind === 'sleep')).toHaveLength(2);
    expect(timeline.some((item) => item.id === 'task:done')).toBe(false);
  });

  it('marks a predicted window that overlaps a planner appointment', () => {
    const now = new Date(2026, 7, 3, 10, 0);
    const timeline = buildCareDayTimeline({
      signals: makeSignals(now),
      plannerBlocks: plannerBlocks(),
      now,
      locale: 'de',
    });

    const firstSleep = timeline.find((item) => item.id === 'sleep:1');
    expect(firstSleep?.conflictTitle).toBe('Kinderarzt');
  });

  it('does not invent future sleep windows while a sleep is running', () => {
    const now = new Date(2026, 7, 3, 10, 0);
    const value = makeSignals(now);
    value.sleep.isSleepingNow = true;
    value.sleep.currentSleepStartedAt = new Date(2026, 7, 3, 9, 40).toISOString();

    const timeline = buildCareDayTimeline({
      signals: value,
      plannerBlocks: [],
      now,
      locale: 'de',
    });

    expect(timeline.filter((item) => item.kind === 'sleep')).toEqual([
      expect.objectContaining({ id: 'sleep:current', status: 'now', isPredicted: false }),
    ]);
  });
});
