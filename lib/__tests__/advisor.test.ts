import { getAdvisorPrimaryAction } from '../advisor/actions';
import { buildFeedingBaselines, buildSleepBaseline } from '../advisor/baselines';
import { buildCareHorizon } from '../advisor/care-horizon';
import { buildMockAnalysis } from '../advisor/mockInsights';
import { buildReliefSuggestions, rankReliefSuggestions } from '../advisor/relief';
import type { DailySignals } from '../advisor/types';

const signals = (overrides: Partial<DailySignals> = {}): DailySignals => ({
  babyName: 'Lotti',
  ageMonths: 5,
  ageText: '5 Monate alt',
  feeding: {
    totalCount: 1,
    bottleCount: 0,
    breastCount: 1,
    solidsCount: 0,
    waterCount: 0,
    totalBottleMl: 0,
    summaryText: 'Stillen 1×',
    isReal: true,
    lastFeedingAt: '2026-07-21T06:30:00',
    hoursSinceLastFeeding: 1.5,
    lastBreastAt: '2026-07-21T06:30:00',
    daysSinceLastBreast: 0,
    breastCountLast21Days: 30,
    bottleCountLast21Days: 0,
    solidsCountLast21Days: 0,
    likelyFeedingMode: 'breast',
    typicalPerDay: 7,
    typicalByNow: 1.2,
    baselineSampleDays: 7,
    typicalIntervalMinutes: 180,
    intervalSampleCount: 8,
  },
  diaper: { count: 1, isReal: true, wetCountToday: 1, lastWetAt: null },
  sleep: {
    minutes: 510,
    text: '8 Std 30 Min',
    isReal: true,
    typicalMinutesByNow: 530,
    baselineSampleDays: 7,
    lastSleepEndAt: '2026-07-21T06:45:00',
    currentSleepStartedAt: null,
    isSleepingNow: false,
    currentAwakeMinutes: 75,
    typicalWakeMinutes: 120,
    wakeSampleCount: 8,
    lastNightMinutes: 510,
    typicalNightMinutes: 530,
    nightSampleDays: 5,
    roughNight: false,
  },
  context: { localHour: 8, localMinute: 0 },
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
  ...overrides,
});

describe('advisor personal baselines', () => {
  it('compares feeding counts at the same local time instead of against a full day', () => {
    const now = new Date(2026, 6, 21, 8, 0);
    const entries = [1, 2, 3].flatMap((daysAgo) => {
      const day = new Date(2026, 6, 21 - daysAgo);
      return [7, 10, 13, 16, 19, 21].map((hour) => ({
        start_time: new Date(
          day.getFullYear(),
          day.getMonth(),
          day.getDate(),
          hour,
        ).toISOString(),
      }));
    });

    const baseline = buildFeedingBaselines(entries, now);
    expect(baseline.typicalPerDay).toBe(6);
    expect(baseline.typicalByNow).toBe(1);
    expect(baseline.sampleDays).toBe(3);
    expect(baseline.typicalIntervalMinutes).toBe(180);
    expect(baseline.intervalSampleCount).toBe(15);
  });

  it('builds a sleep comparison for the same time on previous days', () => {
    const now = new Date(2026, 6, 21, 8, 0);
    const entries = [0, 1, 2, 3].map((daysAgo) => {
      const end = new Date(2026, 6, 21 - daysAgo, 7, 0);
      const start = new Date(end.getTime() - 9 * 60 * 60_000);
      return {
        start_time: start.toISOString(),
        end_time: end.toISOString(),
        duration_minutes: 540,
      };
    });

    const baseline = buildSleepBaseline(entries, now);
    expect(baseline.todayMinutes).toBe(540);
    expect(baseline.typicalMinutesByNow).toBe(540);
    expect(baseline.sampleDays).toBe(3);
  });

  it('recognizes a clearly shorter night only against the personal night baseline', () => {
    const now = new Date(2026, 6, 21, 8, 0);
    const latestStart = new Date(2026, 6, 20, 23, 0);
    const latestEnd = new Date(2026, 6, 21, 3, 0);
    const historical = [1, 2, 3].map((daysAgo) => ({
      start_time: new Date(2026, 6, 20 - daysAgo, 22, 0).toISOString(),
      end_time: new Date(2026, 6, 21 - daysAgo, 6, 0).toISOString(),
      duration_minutes: 480,
    }));

    const baseline = buildSleepBaseline(
      [
        ...historical,
        {
          start_time: latestStart.toISOString(),
          end_time: latestEnd.toISOString(),
          duration_minutes: 240,
        },
      ],
      now,
    );

    expect(baseline.lastNightMinutes).toBe(240);
    expect(baseline.typicalNightMinutes).toBe(480);
    expect(baseline.roughNight).toBe(true);
  });

  it('does not call a normal morning low merely because the full-day average is higher', () => {
    expect(buildMockAnalysis(signals()).main.id).toBe('all_good');
  });

  it('shows a transparent learning state when personal baselines are missing', () => {
    const value = signals();
    value.feeding.typicalPerDay = null;
    value.feeding.typicalByNow = null;
    value.feeding.baselineSampleDays = 1;
    value.sleep.typicalMinutesByNow = null;
    value.sleep.baselineSampleDays = 1;
    expect(buildMockAnalysis(value).main.id).toBe('learning');
  });

  it('uses a long personal interval as a time-relevant feeding signal', () => {
    const value = signals();
    value.feeding.hoursSinceLastFeeding = 5;
    expect(buildMockAnalysis(value).main.id).toBe('low_feeding');
  });
});

describe('advisor care horizon', () => {
  it('shows the next personal sleep window before the later feeding window', () => {
    const horizon = buildCareHorizon(signals(), {
      now: new Date(2026, 6, 21, 8, 0),
    });

    expect(horizon.nextKind).toBe('sleep');
    expect(horizon.nextText).toContain('08:30');
    expect(horizon.nextText).toContain('09:00');
    expect(horizon.windowMinutes).toBe(25);
    expect(horizon.confidenceText).toContain('8 persönlichen Abständen');
  });

  it('does not invent a time while it is still learning the personal rhythm', () => {
    const value = signals();
    value.feeding.typicalIntervalMinutes = null;
    value.feeding.intervalSampleCount = 2;
    value.sleep.typicalWakeMinutes = null;
    value.sleep.wakeSampleCount = 2;

    const horizon = buildCareHorizon(value, {
      now: new Date(2026, 6, 21, 8, 0),
    });

    expect(horizon.isLearning).toBe(true);
    expect(horizon.nextText).toContain('keine erfundene Uhrzeit');
  });

  it('turns limit mode into a concrete handoff request', () => {
    const horizon = buildCareHorizon(signals(), {
      now: new Date(2026, 6, 21, 8, 0),
      atLimit: true,
    });

    expect(horizon.headline).toBe('Jetzt zählt nur die Ablösung');
    expect(horizon.handoffLabel).toBe('Jetzt Ablösung anfragen');
    expect(horizon.handoffMessage).toContain('Ich bin gerade am Limit');
    expect(horizon.handoffMessage).toContain('Einschlafen');
  });

  it('asks a partner to take over around breastfeeding instead of the feed itself', () => {
    const value = signals();
    value.sleep.typicalWakeMinutes = null;
    value.sleep.wakeSampleCount = 0;

    const horizon = buildCareHorizon(value, {
      now: new Date(2026, 6, 21, 8, 0),
    });

    expect(horizon.nextKind).toBe('feeding');
    expect(horizon.handoffMessage).toContain('Drumherum übernehmen');
  });
});

describe('advisor direct actions', () => {
  it('opens the matching feeding quick action', () => {
    expect(getAdvisorPrimaryAction('low_feeding', signals())).toEqual({
      kind: 'feeding',
      label: 'Stillen eintragen',
      quickAction: 'feeding_breast',
    });
  });

  it('turns weather advice into an actionable completion', () => {
    expect(getAdvisorPrimaryAction('rain_likely', signals())).toEqual({
      kind: 'complete',
      label: 'Ich bin vorbereitet',
    });
  });
});

describe('advisor relief flow', () => {
  it('turns low energy into a concrete timed handover instead of tracking', () => {
    const suggestions = buildReliefSuggestions('low', {
      babyName: 'Lotti',
      now: new Date(2026, 6, 22, 10, 3),
    });

    expect(suggestions[0]).toMatchObject({
      id: 'low-delegate-20',
      actionKind: 'delegate',
      actionLabel: 'Konkrete Bitte senden',
    });
    expect(suggestions[0].body).toContain('10:35 Uhr');
    expect(suggestions[0].delegateMessage).toContain('die nächste Wickelrunde');
  });

  it('reduces an okay day to a small set of priorities', () => {
    const [suggestion] = buildReliefSuggestions('okay', { babyName: 'Lotti' });
    expect(suggestion.title).toBe('Heute nur drei Prioritäten');
    expect(suggestion.actionKind).toBe('accept');
    expect(suggestion.body).toContain('Alles andere ist optional');
  });

  it('does not create another optimization task when energy is good', () => {
    const [suggestion] = buildReliefSuggestions('good');
    expect(suggestion.title).toBe('Heute ist nichts zu optimieren');
    expect(suggestion.actionLabel).toBe('Für heute reicht’s');
  });

  it('moves previously helpful relief ahead of the default', () => {
    const suggestions = buildReliefSuggestions('okay');
    const ranked = rankReliefSuggestions(suggestions, [
      { reliefId: 'okay-delegate-one', eventType: 'helped' },
    ]);
    expect(ranked[0].id).toBe('okay-delegate-one');
  });

  it('moves repeatedly unhelpful relief behind alternatives', () => {
    const suggestions = buildReliefSuggestions('low');
    const ranked = rankReliefSuggestions(suggestions, [
      { reliefId: 'low-delegate-20', eventType: 'not_helpful' },
    ]);
    expect(ranked[0].id).not.toBe('low-delegate-20');
  });
});
