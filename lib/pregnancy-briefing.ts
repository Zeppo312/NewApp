import type { AppLocale } from '@/lib/localization';
import { getLocalizedBabySizeForWeek } from '@/lib/babySizeTranslations';
import {
  translatePregnancyBriefingText,
  type PregnancyBriefingTranslationKey,
} from '@/lib/pregnancy-briefing-translations';

export type PregnancyBriefingSelfcareSignal = {
  date: string;
  mood: 'great' | 'good' | 'okay' | 'bad' | 'awful' | null;
  sleepHours: number | null;
  waterIntake: number | null;
  exerciseDone: boolean | null;
};

export type PregnancyBriefingAppointment = {
  id: string;
  title: string;
  startAt: string;
  location: string | null;
};

export type PregnancyBriefingSignals = {
  latestSelfcare: PregnancyBriefingSelfcareSignal | null;
  nextAppointment: PregnancyBriefingAppointment | null;
  openQuestionCount: number;
  checklist: {
    checked: number;
    total: number;
  };
  hasBirthPlan: boolean;
  partnerFirstName: string | null;
};

export type PregnancyBriefingItemKind =
  | 'selfcare'
  | 'appointment'
  | 'questions'
  | 'partner'
  | 'preparation';

export type PregnancyBriefingItem = {
  kind: PregnancyBriefingItemKind;
  title: string;
  body: string;
  actionLabel: string;
  destination: string;
};

export type PregnancyBriefing = {
  title: string;
  intro: string;
  items: PregnancyBriefingItem[];
};

type BuildPregnancyBriefingInput = {
  locale: AppLocale;
  currentWeek: number | null;
  currentDay: number | null;
  signals: PregnancyBriefingSignals;
  now?: Date;
};

const localeTags: Record<AppLocale, string> = {
  de: 'de-DE',
  en: 'en-US',
  es: 'es-ES',
};

const t = (
  locale: AppLocale,
  key: PregnancyBriefingTranslationKey,
  params?: Record<string, string | number>,
) => translatePregnancyBriefingText(locale, key, params);

const formatHours = (locale: AppLocale, hours: number) =>
  new Intl.NumberFormat(localeTags[locale], { maximumFractionDigits: 1 }).format(hours);

const formatAppointmentDate = (locale: AppLocale, value: string) => {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return new Intl.DateTimeFormat(localeTags[locale], {
    weekday: 'short',
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  }).format(parsed);
};

const getSelfcareCopy = (
  locale: AppLocale,
  signal: PregnancyBriefingSelfcareSignal | null,
) => {
  if (signal?.sleepHours !== null && signal?.sleepHours !== undefined && signal.sleepHours < 6.5) {
    return t(locale, 'selfcare.sleep', {
      hours: formatHours(locale, signal.sleepHours),
    });
  }
  if (signal?.mood === 'bad' || signal?.mood === 'awful') {
    return t(locale, 'selfcare.mood');
  }
  if (signal?.waterIntake !== null && signal?.waterIntake !== undefined && signal.waterIntake <= 3) {
    return t(locale, 'selfcare.water');
  }
  if (signal?.exerciseDone === false) {
    return t(locale, 'selfcare.movement');
  }
  return t(locale, 'selfcare.default');
};

const getPartnerTask = (locale: AppLocale, week: number | null, seed: number) => {
  const trimester = week === null || week <= 13
    ? 'first'
    : week <= 27
      ? 'second'
      : 'third';
  const taskIndex = Math.abs(seed) % 3;
  return t(locale, `partner.task.${trimester}.${taskIndex}` as PregnancyBriefingTranslationKey);
};

const buildPreparationItem = (
  locale: AppLocale,
  week: number | null,
  signals: PregnancyBriefingSignals,
): PregnancyBriefingItem => {
  if ((week ?? 0) >= 24 && !signals.hasBirthPlan) {
    return {
      kind: 'preparation',
      title: t(locale, 'section.preparation'),
      body: t(locale, 'preparation.birthPlan'),
      actionLabel: t(locale, 'action.birthPlan'),
      destination: '/(tabs)/geburtsplan',
    };
  }

  if ((week ?? 0) >= 28 && signals.checklist.total === 0) {
    return {
      kind: 'preparation',
      title: t(locale, 'section.preparation'),
      body: t(locale, 'preparation.checklist.empty'),
      actionLabel: t(locale, 'action.checklist'),
      destination: '/(tabs)/explore',
    };
  }

  if (
    (week ?? 0) >= 28 &&
    signals.checklist.total > 0 &&
    signals.checklist.checked < signals.checklist.total
  ) {
    return {
      kind: 'preparation',
      title: t(locale, 'section.preparation'),
      body: t(locale, 'preparation.checklist.progress', {
        checked: signals.checklist.checked,
        total: signals.checklist.total,
      }),
      actionLabel: t(locale, 'action.checklist'),
      destination: '/(tabs)/explore',
    };
  }

  if ((week ?? 0) >= 34) {
    return {
      kind: 'preparation',
      title: t(locale, 'section.preparation'),
      body: t(locale, 'preparation.late'),
      actionLabel: t(locale, 'action.countdown'),
      destination: '/(tabs)/countdown?focus=birth-preparation',
    };
  }

  return {
    kind: 'preparation',
    title: t(locale, 'section.preparation'),
    body: t(locale, 'preparation.early'),
    actionLabel: t(locale, 'action.planner'),
    destination: '/planner',
  };
};

export const buildPregnancyBriefing = ({
  locale,
  currentWeek,
  currentDay,
  signals,
  now = new Date(),
}: BuildPregnancyBriefingInput): PregnancyBriefing => {
  const normalizedWeek = currentWeek !== null
    ? Math.min(42, Math.max(1, currentWeek))
    : null;
  const normalizedDay = currentDay !== null
    ? Math.min(6, Math.max(0, currentDay))
    : 0;
  const weekFact = normalizedWeek !== null
    ? getLocalizedBabySizeForWeek(locale, normalizedWeek)?.description ?? ''
    : '';
  const hasSelfcareSignal = signals.latestSelfcare !== null;
  const title = normalizedWeek !== null
    ? t(locale, 'title.week', { week: normalizedWeek, day: normalizedDay })
    : t(locale, 'title.fallback');
  const intro = normalizedWeek === null
    ? t(locale, 'intro.noWeek')
    : t(
      locale,
      hasSelfcareSignal ? 'intro.withSelfcare' : 'intro.default',
      { weekFact },
    );

  const appointmentBody = signals.nextAppointment
    ? t(locale, 'appointment.withDate', {
      title: signals.nextAppointment.title,
      date: formatAppointmentDate(locale, signals.nextAppointment.startAt),
    })
    : t(locale, 'appointment.none');
  const questionsBody = signals.openQuestionCount === 0
    ? t(locale, 'questions.none')
    : signals.openQuestionCount === 1
      ? t(locale, 'questions.one')
      : t(locale, 'questions.many', { count: signals.openQuestionCount });
  const seed = now.getFullYear() * 1000 + now.getMonth() * 40 + now.getDate() + (normalizedWeek ?? 0);
  const partnerTask = getPartnerTask(locale, normalizedWeek, seed);
  const partnerBody = signals.partnerFirstName
    ? t(locale, 'partner.connected', { name: signals.partnerFirstName, task: partnerTask })
    : t(locale, 'partner.generic', { task: partnerTask });

  return {
    title,
    intro,
    items: [
      {
        kind: 'selfcare',
        title: t(locale, 'section.selfcare'),
        body: getSelfcareCopy(locale, signals.latestSelfcare),
        actionLabel: t(locale, 'action.selfcare'),
        destination: '/(tabs)/selfcare',
      },
      {
        kind: 'appointment',
        title: t(locale, 'section.appointment'),
        body: appointmentBody,
        actionLabel: t(locale, 'action.planner'),
        destination: '/planner',
      },
      {
        kind: 'questions',
        title: t(locale, 'section.questions'),
        body: questionsBody,
        actionLabel: t(locale, 'action.questions'),
        destination: '/doctor-questions',
      },
      {
        kind: 'partner',
        title: t(locale, 'section.partner'),
        body: partnerBody,
        actionLabel: t(locale, 'action.partner'),
        destination: signals.partnerFirstName ? '/planner' : '/account-linking',
      },
      buildPreparationItem(locale, normalizedWeek, signals),
    ],
  };
};

export const EMPTY_PREGNANCY_BRIEFING_SIGNALS: PregnancyBriefingSignals = {
  latestSelfcare: null,
  nextAppointment: null,
  openQuestionCount: 0,
  checklist: { checked: 0, total: 0 },
  hasBirthPlan: false,
  partnerFirstName: null,
};
