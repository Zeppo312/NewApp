/**
 * Lottis Fürsorge – Schwangerschaftsmodus: lokale Analyse.
 *
 * Nutzt dieselbe Regel-Engine wie die Edge Function (eine Quelle für
 * Regel-Ids und Texte) und baut daraus das AdvisorAnalysis-Objekt, das die
 * Seite sofort anzeigen kann. Kommt der Server-Hinweis (Regeln + KI), ersetzt
 * er nur den Haupt-Hinweis – Karten bleiben lokal.
 */

import {
  evaluatePregnancyRules,
  selectPregnancyCandidate,
  type PregnancyRuleSignals,
} from './pregnancyRules';
import type { AppLocale } from '@/lib/localization';

import type { PregnancySignals } from './pregnancySignals';
import type { AdvisorAnalysis, AdvisorInsight, AnalysisCard } from './types';

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));

const pick = <T>(locale: AppLocale, values: Record<AppLocale, T>): T => values[locale];

/** Reduziert die App-Signale auf das, was die Regel-Engine/Edge Function braucht. */
export const toPregnancyRuleSignals = (s: PregnancySignals): PregnancyRuleSignals => ({
  motherName: s.motherName,
  week: s.week,
  day: s.day,
  trimester: s.trimester,
  daysUntilDue: s.daysUntilDue,
  selfcare: {
    hasToday: s.selfcare.hasToday,
    checkinsLast7Days: s.selfcare.checkinsLast7Days,
    latestMood: s.selfcare.latestMood,
    latestSleepHours: s.selfcare.latestSleepHours,
    latestWaterIntake: s.selfcare.latestWaterIntake,
    latestExerciseDone: s.selfcare.latestExerciseDone,
    averageSleepHours: s.selfcare.averageSleepHours,
    averageWaterIntake: s.selfcare.averageWaterIntake,
    exerciseDaysLast7: s.selfcare.exerciseDaysLast7,
    lowMoodStreak: s.selfcare.lowMoodStreak,
  },
  weight: {
    latestKg: s.weight.latestKg,
    change30Days: s.weight.change30Days,
    entriesLast30Days: s.weight.entriesLast30Days,
  },
  contractions: { ...s.contractions },
  nextAppointment: s.nextAppointment
    ? { title: s.nextAppointment.title, inDays: s.nextAppointment.inDays }
    : null,
  openQuestionCount: s.openQuestionCount,
  checklist: { ...s.checklist },
  hasBirthPlan: s.hasBirthPlan,
  partnerFirstName: s.partnerFirstName,
  context: s.context,
  weather: {
    available: s.weather.available,
    temperature: s.weather.temperature,
    isHot: s.weather.isHot,
    isCold: s.weather.isCold,
    uvIndex: s.weather.uvIndex,
    rainProbability: s.weather.rainProbability,
    isHighUv: s.weather.isHighUv,
    isRainy: s.weather.isRainy,
  },
});

const moodEmoji: Record<NonNullable<PregnancySignals['selfcare']['latestMood']>, string> = {
  great: '😊',
  good: '🙂',
  okay: '😐',
  bad: '😔',
  awful: '😢',
};

const moodLabel = (
  mood: PregnancySignals['selfcare']['latestMood'],
  locale: AppLocale,
): string | null => {
  if (!mood) return null;
  return pick(locale, {
    de: { great: 'Sehr gut', good: 'Gut', okay: 'Okay', bad: 'Nicht so gut', awful: 'Schlecht' },
    en: { great: 'Great', good: 'Good', okay: 'Okay', bad: 'Not so good', awful: 'Awful' },
    es: { great: 'Muy bien', good: 'Bien', okay: 'Regular', bad: 'Mal', awful: 'Muy mal' },
  })[mood];
};

/** Vier Mini-Karten: Woche, Selfcare, Trinken, Gewicht. */
export const buildPregnancyCards = (s: PregnancySignals, locale: AppLocale): AnalysisCard[] => {
  const recorded = pick(locale, { de: 'Heute erfasst', en: 'Recorded today', es: 'Registrado hoy' });
  const nothing = pick(locale, { de: 'Noch nichts erfasst', en: 'Nothing recorded yet', es: 'Aún sin registros' });
  const latest = pick(locale, { de: 'Letzter Check-in', en: 'Latest check-in', es: 'Último check-in' });
  const sleep = s.selfcare.latestSleepHours;
  const water = s.selfcare.latestWaterIntake;
  const hasCheckin = s.selfcare.latestDate != null;
  const checkinCaption = s.selfcare.hasToday ? recorded : hasCheckin ? latest : nothing;

  return [
    {
      key: 'week',
      emoji: '🤰',
      label: pick(locale, { de: 'Schwangerschaft', en: 'Pregnancy', es: 'Embarazo' }),
      value:
        s.week != null
          ? pick(locale, { de: `SSW ${s.week}`, en: `Week ${s.week}`, es: `Semana ${s.week}` })
          : '–',
      caption:
        s.daysUntilDue == null
          ? pick(locale, { de: 'Kein Termin hinterlegt', en: 'No due date saved', es: 'Sin fecha prevista' })
          : s.daysUntilDue > 0
            ? pick(locale, {
                de: `Noch ${s.daysUntilDue} Tage · ${s.trimester}. Trimester`,
                en: `${s.daysUntilDue} days to go · trimester ${s.trimester}`,
                es: `Faltan ${s.daysUntilDue} días · ${s.trimester}.º trimestre`,
              })
            : pick(locale, { de: 'Termin erreicht', en: 'Due date reached', es: 'Fecha prevista alcanzada' }),
      progress: s.week != null ? clamp01(s.week / 40) : 0,
      isReal: true,
    },
    {
      key: 'selfcare',
      emoji: s.selfcare.latestMood ? moodEmoji[s.selfcare.latestMood] : '🌿',
      label: pick(locale, { de: 'Selfcare', en: 'Self-care', es: 'Autocuidado' }),
      value:
        moodLabel(s.selfcare.latestMood, locale) ??
        (sleep != null
          ? pick(locale, { de: `${sleep} Std. Schlaf`, en: `${sleep} h sleep`, es: `${sleep} h de sueño` })
          : '–'),
      caption:
        sleep != null && s.selfcare.latestMood
          ? pick(locale, { de: `${sleep} Std. Schlaf · ${checkinCaption}`, en: `${sleep} h sleep · ${checkinCaption}`, es: `${sleep} h de sueño · ${checkinCaption}` })
          : checkinCaption,
      progress: sleep != null ? clamp01(sleep / 8) : 0,
      isReal: true,
    },
    {
      key: 'hydration',
      emoji: '💧',
      label: pick(locale, { de: 'Trinken', en: 'Hydration', es: 'Hidratación' }),
      value:
        water != null
          ? pick(locale, { de: `${water} Gläser`, en: `${water} glasses`, es: `${water} vasos` })
          : '–',
      caption: water != null ? checkinCaption : nothing,
      progress: water != null ? clamp01(water / 8) : 0,
      isReal: true,
    },
    {
      key: 'weight',
      emoji: '⚖️',
      label: pick(locale, { de: 'Gewicht', en: 'Weight', es: 'Peso' }),
      value: s.weight.latestKg != null ? `${s.weight.latestKg} kg` : '–',
      caption:
        s.weight.change30Days != null
          ? pick(locale, {
              de: `${s.weight.change30Days > 0 ? '+' : ''}${s.weight.change30Days} kg in 30 Tagen`,
              en: `${s.weight.change30Days > 0 ? '+' : ''}${s.weight.change30Days} kg in 30 days`,
              es: `${s.weight.change30Days > 0 ? '+' : ''}${s.weight.change30Days} kg en 30 días`,
            })
          : s.weight.latestKg != null
            ? pick(locale, { de: 'Letzter Eintrag', en: 'Latest entry', es: 'Último registro' })
            : nothing,
      progress: s.weight.entriesLast30Days > 0 ? clamp01(s.weight.entriesLast30Days / 4) : 0,
      isReal: true,
    },
  ];
};

/**
 * Lokale Analyse (Regeln + Karten). Liefert den wichtigsten Hinweis als
 * `main`, die übrigen zutreffenden Regeln als `history` („Weitere Hinweise").
 */
export const buildPregnancyAnalysis = (
  signals: PregnancySignals,
  locale: AppLocale,
  options: { themes?: ('weather' | 'sleep' | 'feeding' | 'motivation')[] | null; recentRuleIds?: string[] } = {},
): AdvisorAnalysis => {
  const ruleSignals = toPregnancyRuleSignals(signals);
  const candidates = evaluatePregnancyRules(ruleSignals, locale);
  const main = selectPregnancyCandidate(candidates, options);
  const toInsight = (c: typeof main): AdvisorInsight => ({
    id: c.ruleId,
    tone: c.tone,
    emoji: c.emoji,
    title: c.title,
    headline: c.headline,
    body: c.body,
  });
  return {
    main: toInsight(main),
    reasons: main.reasons,
    history: candidates
      .filter((c) => c.ruleId !== main.ruleId && c.ruleId !== 'preg_learning')
      .slice(0, 3)
      .map((c) => ({ ...toInsight(c), id: `h_${c.ruleId}` })),
    cards: buildPregnancyCards(signals, locale),
  };
};
