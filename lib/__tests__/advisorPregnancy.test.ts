import {
  evaluatePregnancyRules,
  selectPregnancyCandidate,
  type PregnancyRuleSignals,
} from '../advisor/pregnancyRules';
import { buildPregnancyAnalysis, buildPregnancyCards } from '../advisor/pregnancyInsights';
import {
  buildEmptyPregnancySignals,
  pregnancyProgressFromDueDate,
  summarizeContractions,
  summarizeSelfcare,
  summarizeWeight,
  type PregnancySignals,
} from '../advisor/pregnancySignals';

const signals = (overrides: Partial<PregnancySignals> = {}): PregnancySignals => ({
  ...buildEmptyPregnancySignals('Anna'),
  week: 30,
  day: 2,
  trimester: 3,
  daysUntilDue: 68,
  dueDate: '2026-11-10',
  selfcare: {
    hasToday: true,
    checkinsLast7Days: 4,
    latestDate: '2026-09-03T07:00:00Z',
    latestMood: 'good',
    latestSleepHours: 7,
    latestWaterIntake: 8,
    latestExerciseDone: true,
    averageSleepHours: 7.2,
    averageWaterIntake: 7.5,
    exerciseDaysLast7: 2,
    lowMoodStreak: 0,
  },
  weight: { latestKg: 69.5, latestDate: '2026-09-02', change30Days: 1.2, entriesLast30Days: 3 },
  hasBirthPlan: true,
  checklist: { checked: 10, total: 10 },
  context: { localHour: 12, localMinute: 0 },
  ...overrides,
});

describe('pregnancy rules file sync', () => {
  it('keeps the edge-function copy identical to lib/advisor/pregnancyRules.ts', () => {
    const fs = require('fs');
    const path = require('path');
    const strip = (file: string) =>
      fs.readFileSync(path.join(__dirname, file), 'utf8').replace(/^\/\/.*\n/gm, '');
    expect(strip('../../supabase/functions/advisor-generate/pregnancyRules.ts')).toBe(
      strip('../advisor/pregnancyRules.ts'),
    );
  });
});

describe('pregnancy signal summaries', () => {
  const now = new Date('2026-09-03T12:00:00');

  it('derives SSW, trimester and countdown from the due date', () => {
    expect(pregnancyProgressFromDueDate('2026-11-10T00:00:00', now)).toMatchObject({
      week: 31,
      trimester: 3,
      daysUntilDue: 68,
      dueDate: '2026-11-10',
    });
    expect(pregnancyProgressFromDueDate(null, now).week).toBeNull();
  });

  it('summarizes check-ins with averages and a low-mood streak', () => {
    const summary = summarizeSelfcare(
      [
        { date: '2026-09-03T08:00:00', mood: 'bad', sleep_hours: 5, water_intake: 4, exercise_done: false },
        { date: '2026-09-02T08:00:00', mood: 'awful', sleep_hours: 6, water_intake: 6, exercise_done: true },
        { date: '2026-09-01T08:00:00', mood: 'good', sleep_hours: 8, water_intake: 8, exercise_done: true },
      ],
      now,
    );
    expect(summary).toMatchObject({
      hasToday: true,
      checkinsLast7Days: 3,
      latestMood: 'bad',
      latestSleepHours: 5,
      averageSleepHours: 6.3,
      averageWaterIntake: 6,
      exerciseDaysLast7: 2,
      lowMoodStreak: 2,
    });
  });

  it('summarizes the weight trend and contraction rhythm', () => {
    expect(
      summarizeWeight(
        [
          { date: '2026-08-10', weight: '68.0' },
          { date: '2026-09-02', weight: 69.5 },
        ],
        now,
      ),
    ).toMatchObject({ latestKg: 69.5, change30Days: 1.5, entriesLast30Days: 2 });
    expect(
      summarizeContractions(
        [
          { start_time: '2026-09-03T10:00:00', end_time: null, duration: 40 },
          { start_time: '2026-09-03T10:06:00', end_time: null, duration: 50 },
          { start_time: '2026-09-03T10:12:00', end_time: '2026-09-03T10:13:00', duration: null },
        ],
        now,
      ),
    ).toEqual({ countLast24h: 3, averageIntervalMinutes: 6, averageDurationSeconds: 50 });
  });
});

describe('pregnancy rules', () => {
  it('leads with regular contractions and points to the midwife', () => {
    const candidates = evaluatePregnancyRules(
      signals({ contractions: { countLast24h: 8, averageIntervalMinutes: 7, averageDurationSeconds: 50 } }),
      'de',
    );
    expect(candidates[0].ruleId).toBe('preg_contractions_regular');
    expect(candidates[0].body).toContain('Hebamme');
    // The safety rule survives topic filters and cooldowns.
    expect(
      selectPregnancyCandidate(candidates, { themes: ['weather'], recentRuleIds: ['preg_contractions_regular'] })
        .ruleId,
    ).toBe('preg_contractions_regular');
  });

  it('combines heat with low water intake into the top hint', () => {
    const candidates = evaluatePregnancyRules(
      signals({
        selfcare: { ...signals().selfcare, latestWaterIntake: 3 },
        weather: { ...signals().weather, available: true, temperature: 31, isHot: true },
      }),
      'en',
    );
    expect(candidates.map((c) => c.ruleId).slice(0, 3)).toEqual(['preg_hot_low_water', 'preg_hot', 'preg_low_water']);
    expect(candidates[0].body).toContain('31°');
  });

  it('reminds about the hospital bag and birth plan late in pregnancy', () => {
    const candidates = evaluatePregnancyRules(
      signals({ week: 35, checklist: { checked: 2, total: 12 }, hasBirthPlan: false }),
      'de',
    );
    expect(candidates.map((c) => c.ruleId)).toEqual(
      expect.arrayContaining(['preg_hospital_bag', 'preg_birth_plan']),
    );
    expect(candidates.find((c) => c.ruleId === 'preg_hospital_bag')?.body).toContain('2 von 12');
  });

  it('flags tomorrow’s appointment with the saved questions', () => {
    const [top] = evaluatePregnancyRules(
      signals({ nextAppointment: { title: 'Vorsorge', startAt: '', location: null, inDays: 1 }, openQuestionCount: 2 }),
      'de',
    );
    expect(top.ruleId).toBe('preg_appointment_soon');
    expect(top.headline).toContain('morgen');
    expect(top.body).toContain('2 Fragen');
  });

  it('falls back to all_good and learning', () => {
    const good = evaluatePregnancyRules(signals(), 'es');
    expect(good[0].ruleId).toBe('preg_all_good');
    const learning = evaluatePregnancyRules(buildEmptyPregnancySignals(''), 'en');
    expect(learning[0].ruleId).toBe('preg_learning');
    expect(learning[0].body).toContain('due date');
  });

  it('respects theme filters and cooldowns like the baby engine', () => {
    const candidates = evaluatePregnancyRules(
      signals({ selfcare: { ...signals().selfcare, latestSleepHours: 4, latestWaterIntake: 3 } }),
      'de',
    );
    expect(selectPregnancyCandidate(candidates, { themes: ['sleep'] }).ruleId).toBe('preg_low_sleep');
    expect(selectPregnancyCandidate(candidates, { recentRuleIds: ['preg_low_water'] }).ruleId).toBe('preg_low_sleep');
  });
});

describe('pregnancy analysis for the screen', () => {
  it('builds four localized cards from the signals', () => {
    const cards = buildPregnancyCards(signals(), 'en');
    expect(cards.map((card) => card.key)).toEqual(['week', 'selfcare', 'hydration', 'weight']);
    expect(cards[0]).toMatchObject({ value: 'Week 30', progress: 0.75 });
    expect(cards[1].value).toBe('Good');
    expect(cards[2].value).toBe('8 glasses');
    expect(cards[3].caption).toBe('+1.2 kg in 30 days');
  });

  it('puts the selected rule in main and the others into history', () => {
    const analysis = buildPregnancyAnalysis(
      signals({ week: 36, checklist: { checked: 0, total: 0 }, hasBirthPlan: false }),
      'de',
    );
    expect(analysis.main.id).toBe('preg_hospital_bag');
    expect(analysis.reasons[0]).toContain('Kliniktasche');
    expect(analysis.history.map((item) => item.id)).toContain('h_preg_birth_plan');
    expect(analysis.history.map((item) => item.id)).not.toContain('h_preg_learning');
  });

  it('keeps the rule engine input free of app-only fields', () => {
    const ruleSignals: PregnancyRuleSignals = {
      ...signals(),
      nextAppointment: null,
    } as PregnancyRuleSignals;
    expect(evaluatePregnancyRules(ruleSignals, 'de').length).toBeGreaterThan(0);
  });
});
