import {
  buildPregnancyBriefing,
  EMPTY_PREGNANCY_BRIEFING_SIGNALS,
  type PregnancyBriefingSignals,
} from '../pregnancy-briefing';
import { PREGNANCY_BRIEFING_TRANSLATIONS } from '../pregnancy-briefing-translations';

const createSignals = (
  overrides: Partial<PregnancyBriefingSignals> = {},
): PregnancyBriefingSignals => ({
  ...EMPTY_PREGNANCY_BRIEFING_SIGNALS,
  checklist: { ...EMPTY_PREGNANCY_BRIEFING_SIGNALS.checklist },
  ...overrides,
});

describe('pregnancy briefing', () => {
  it('builds a complete daily briefing for the current pregnancy day', () => {
    const briefing = buildPregnancyBriefing({
      locale: 'de',
      currentWeek: 27,
      currentDay: 3,
      now: new Date('2026-08-04T08:00:00.000Z'),
      signals: createSignals({
        latestSelfcare: {
          date: '2026-08-03T10:00:00.000Z',
          mood: 'okay',
          sleepHours: 5.5,
          waterIntake: 6,
          exerciseDone: true,
        },
        nextAppointment: {
          id: 'appointment-1',
          title: 'Vorsorge',
          startAt: '2026-08-06T08:30:00.000Z',
          location: 'Praxis',
        },
        openQuestionCount: 2,
        partnerFirstName: 'Alex',
      }),
    });

    expect(briefing.title).toBe('Heute: SSW 27+3');
    expect(briefing.items).toHaveLength(5);
    expect(briefing.items.find((item) => item.kind === 'selfcare')?.body).toContain('5,5 Stunden Schlaf');
    expect(briefing.items.find((item) => item.kind === 'appointment')?.body).toContain('Vorsorge');
    expect(briefing.items.find((item) => item.kind === 'questions')?.body).toContain('2 Fragen');
    expect(briefing.items.find((item) => item.kind === 'partner')?.body).toContain('Alex');
  });

  it('prioritizes the birth plan and then an unfinished hospital checklist', () => {
    const withoutBirthPlan = buildPregnancyBriefing({
      locale: 'en',
      currentWeek: 31,
      currentDay: 0,
      signals: createSignals({
        hasBirthPlan: false,
        checklist: { checked: 4, total: 12 },
      }),
    });
    expect(withoutBirthPlan.items.at(-1)?.destination).toBe('/(tabs)/geburtsplan');

    const withBirthPlan = buildPregnancyBriefing({
      locale: 'en',
      currentWeek: 31,
      currentDay: 0,
      signals: createSignals({
        hasBirthPlan: true,
        checklist: { checked: 4, total: 12 },
      }),
    });
    expect(withBirthPlan.items.at(-1)?.destination).toBe('/(tabs)/explore');
    expect(withBirthPlan.items.at(-1)?.body).toContain('4 of 12');
  });

  it('keeps the localized catalogs aligned and resolves every placeholder', () => {
    const germanKeys = Object.keys(PREGNANCY_BRIEFING_TRANSLATIONS.de).sort();
    expect(Object.keys(PREGNANCY_BRIEFING_TRANSLATIONS.en).sort()).toEqual(germanKeys);
    expect(Object.keys(PREGNANCY_BRIEFING_TRANSLATIONS.es).sort()).toEqual(germanKeys);

    for (const locale of ['de', 'en', 'es'] as const) {
      const briefing = buildPregnancyBriefing({
        locale,
        currentWeek: 18,
        currentDay: 5,
        signals: createSignals(),
      });
      expect(JSON.stringify(briefing)).not.toContain('{{');
      expect(briefing.intro.length).toBeGreaterThan(40);
    }
  });
});
