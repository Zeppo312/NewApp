import type { RealtimeChannel } from '@supabase/supabase-js';

import {
  DEFAULT_DISPLAY_MONTHLY_PRICE,
  DEFAULT_DISPLAY_YEARLY_PRICE,
  DEFAULT_PAYWALL_TRIAL_DAYS,
} from './paywallDefaults';
import { supabase } from './supabase';

export const PAYWALL_CONTENT_CONFIG_ID = 'default';

export type PaywallContentSettings = {
  trialDays: string;
  monthlyPrice: string;
  yearlyPrice: string;
};

export type PaywallTemplateValues = {
  appName: string;
  trialDays: string;
  trialDaysAfter: string;
  trialDaysNumber: string;
  trialDaysPlusOne: string;
  monthlyDisplayPrice: string;
  yearlyDisplayPrice: string;
  monthlyPriceText: string;
  yearlyPriceText: string;
  billingLabel: string;
  yearlySavings: string;
};

export type PaywallHeroStat = {
  value: string;
  label: string;
};

export type PaywallPreviewRow = {
  label: string;
  value: string;
};

export type PaywallTimelineItem = {
  badge: string;
  label: string;
  description: string;
};

export type PaywallFeatureItem = {
  badge: string;
  text: string;
};

export type PaywallPlanCopy = {
  badge: string;
  highlight: string;
  title: string;
  description: string;
  bullets: string[];
  note: string;
  buttonLabel: string;
  savingsInline?: string;
};

export type PaywallLegalLinks = {
  privacy: string;
  terms: string;
  appleEula: string;
  imprint: string;
  dataManagement: string;
};

export type PaywallContent = {
  settings: PaywallContentSettings;
  brand: {
    logo: string;
    subtitle: string;
  };
  steps: {
    introEyebrow: string;
    reminderEyebrow: string;
    pricingEyebrow: string;
  };
  progressCard: {
    title: string;
    subtitle: string;
    buttonLabel: string;
    skipLabel: string;
  };
  intro: {
    title: string;
    subtitle: string;
    summary: string;
    miniBenefit: string;
    heroDealNote: string;
    heroTitle: string;
    heroSubtitle: string;
    heroStats: PaywallHeroStat[];
    previewRows: PaywallPreviewRow[];
  };
  reminder: {
    title: string;
    subtitle: string;
    timelineItems: PaywallTimelineItem[];
  };
  pricing: {
    title: string;
    subtitle: string;
    socialProof: string;
    featureTitle: string;
    features: PaywallFeatureItem[];
    monthlyPlan: PaywallPlanCopy;
    yearlyPlan: PaywallPlanCopy;
    restoreLabel: string;
    cancelLabel: string;
  };
  legal: {
    paragraphs: string[];
    links: PaywallLegalLinks;
  };
};

export type PaywallContentRecord = {
  content: PaywallContent;
  updatedAt: string | null;
};

export const PAYWALL_TEMPLATE_HINTS: {
  token: keyof PaywallTemplateValues;
  description: string;
}[] = [
  { token: 'trialDays', description: 'z. B. 14 Tage' },
  { token: 'trialDaysAfter', description: 'z. B. 14 Tagen' },
  { token: 'trialDaysNumber', description: 'z. B. 14' },
  { token: 'trialDaysPlusOne', description: 'z. B. 15' },
  { token: 'monthlyDisplayPrice', description: 'z. B. 4,99 €' },
  { token: 'yearlyDisplayPrice', description: 'z. B. 44,99 €' },
  { token: 'monthlyPriceText', description: 'z. B. 4,99 € pro Monat' },
  { token: 'yearlyPriceText', description: 'z. B. 44,99 € pro Jahr' },
  { token: 'billingLabel', description: 'Store-Hinweis je Plattform' },
  { token: 'yearlySavings', description: 'Ersparnis Jahresabo' },
  { token: 'appName', description: 'Lotti Baby' },
];

const DEFAULT_MONTHLY_PLAN: PaywallPlanCopy = {
  badge: 'Monatsabo',
  highlight: 'pro Monat',
  title: 'Monatlich flexibel',
  description:
    'Für die Nutzung von {{appName}} nach den ersten {{trialDaysAfter}}. Zahlung wird bei Bestätigung im Store fällig.',
  bullets: ['Voller Zugriff auf alle Inhalte', 'Jederzeit kündbar'],
  note: 'Ideal, wenn du erst einmal flexibel bleiben möchtest.',
  buttonLabel: 'Monatsabo starten',
};

const DEFAULT_YEARLY_PLAN: PaywallPlanCopy = {
  badge: 'Jahresabo',
  highlight: '{{yearlySavings}} sparen',
  title: 'Günstiger im Jahrespaket',
  description:
    'Einmal im Jahr zahlen, {{appName}} nach den ersten {{trialDaysAfter}} ohne Unterbrechung weiter nutzen und {{yearlySavings}} gegenüber dem Monatsabo sparen.',
  bullets: [
    'Bester Preis für die ganze App',
    'Läuft das ganze Jahr ohne Unterbrechung',
  ],
  note: 'Automatische Verlängerung bis zur Kündigung in den Store-Einstellungen.',
  buttonLabel: 'Jahresabo starten',
  savingsInline: 'Spare {{yearlySavings}}',
};

export const DEFAULT_PAYWALL_CONTENT: PaywallContent = {
  settings: {
    trialDays: `${DEFAULT_PAYWALL_TRIAL_DAYS}`,
    monthlyPrice: `${DEFAULT_DISPLAY_MONTHLY_PRICE}`.replace('.', ','),
    yearlyPrice: `${DEFAULT_DISPLAY_YEARLY_PRICE}`.replace('.', ','),
  },
  brand: {
    logo: 'Lotti Baby',
    subtitle: 'Schwangerschaft bis Baby-Alltag',
  },
  steps: {
    introEyebrow: 'Kostenlos testen',
    reminderEyebrow: 'So funktioniert es',
    pricingEyebrow: 'Passendes Abo wählen',
  },
  progressCard: {
    title: 'Alles transparent erklärt',
    subtitle: 'Kein Kauf auf diesem Schritt. Erst einmal Überblick, dann Preiswahl.',
    buttonLabel: 'Weiter',
    skipLabel: 'Vielleicht später',
  },
  intro: {
    title: '{{trialDays}} kostenlos, danach Abo',
    subtitle:
      '{{appName}} ist nach der kostenlosen Phase nur mit aktivem Abo weiter nutzbar. Es geht also nicht um einzelne Extras, sondern um die App insgesamt.',
    summary: 'Aktuell {{monthlyPriceText}} oder {{yearlyPriceText}}.',
    miniBenefit:
      'Nach {{trialDaysAfter}} brauchst du ein aktives Abo, um {{appName}} weiter zu nutzen.',
    heroDealNote: 'Im Jahresabo nur {{yearlyDisplayPrice}} · du sparst {{yearlySavings}}',
    heroTitle: 'Alles in einer App',
    heroSubtitle: 'Von Schwangerschaft bis Baby-Alltag.',
    heroStats: [
      { value: '{{trialDays}}', label: 'kostenlos testen' },
      { value: '{{monthlyDisplayPrice}}', label: 'pro Monat' },
      { value: 'Abo', label: 'für die ganze App' },
    ],
    previewRows: [
      {
        label: 'Schwangerschaft',
        value: 'Wehen, Checkliste, Geburtsplan',
      },
      {
        label: 'Baby',
        value: 'Schlaf, Füttern, Wachstum',
      },
      {
        label: 'Organisation',
        value: 'Planner, Listen, Auswertungen',
      },
    ],
  },
  reminder: {
    title: 'So läuft es nach der Testphase',
    subtitle:
      'Die ersten {{trialDays}} kannst du {{appName}} kostenlos nutzen. Danach ist ein Abo nötig, um die App weiter zu verwenden.',
    timelineItems: [
      {
        badge: '1',
        label: 'Tag 1 bis {{trialDaysNumber}}',
        description:
          'Voller Zugriff auf Schwangerschaft, Baby, Planung und Auswertungen.',
      },
      {
        badge: '2',
        label: 'Ab Tag {{trialDaysPlusOne}}',
        description:
          'Ohne aktives Abo kannst du {{appName}} nicht weiter nutzen.',
      },
      {
        badge: 'M',
        label: 'Monatsabo',
        description: '{{monthlyPriceText}} · {{billingLabel}}',
      },
      {
        badge: 'J',
        label: 'Jahresabo',
        description: '{{yearlyPriceText}} · {{billingLabel}}',
      },
      {
        badge: '✓',
        label: 'Kündigung',
        description: 'Jederzeit in den Store-Einstellungen.',
      },
    ],
  },
  pricing: {
    title: '{{appName}} weiter nutzen',
    subtitle:
      'Wähle dein Abo für die Zeit nach den ersten {{trialDaysAfter}} kostenloser Nutzung.',
    socialProof:
      'Alles enthalten, was dich vor und nach der Geburt begleitet.',
    featureTitle: 'Das ist in {{appName}} enthalten:',
    features: [
      {
        badge: '1',
        text: 'Schwangerschaft: Wehen-Tracker, Kliniktaschen-Checkliste, Geburtsplan und Babynamen',
      },
      {
        badge: '2',
        text: 'Baby: Schlaftracker, Stillen, Flasche, Beikost und Tagesübersicht',
      },
      {
        badge: '3',
        text: 'Entwicklung: Gewichtskurve, Größenkurve, Zahn-Tracker und Meilensteine',
      },
      {
        badge: '4',
        text: 'Alltag: Planer, Listen, Auswertungen, PDF-Exporte und weitere Familien-Tools',
      },
    ],
    monthlyPlan: DEFAULT_MONTHLY_PLAN,
    yearlyPlan: DEFAULT_YEARLY_PLAN,
    restoreLabel: 'Käufe wiederherstellen / Status aktualisieren',
    cancelLabel: 'Vielleicht später',
  },
  legal: {
    paragraphs: [
      'Nach den ersten {{trialDaysAfter}} ist für die weitere Nutzung ein Abo erforderlich. Zahlung wird bei Kaufbestätigung deinem App-Store/Google-Play-Konto belastet. Abos verlängern sich automatisch, wenn sie nicht rechtzeitig gekündigt werden.',
      'Mit dem Kauf gelten die Nutzungsbedingungen und auf iOS ergänzend die Apple-Standard-EULA; Hinweise zur Datenverarbeitung findest du direkt im Datenschutz.',
    ],
    links: {
      privacy: 'Datenschutz',
      terms: 'Nutzungsbedingungen',
      appleEula: 'Apple-Standard-EULA',
      imprint: 'Impressum',
      dataManagement: 'Konto & Daten verwalten',
    },
  },
};

const cloneArray = <T,>(items: T[]): T[] => items.map((item) => {
  if (Array.isArray(item)) {
    return cloneArray(item) as T;
  }

  if (item && typeof item === 'object') {
    return { ...(item as Record<string, unknown>) } as T;
  }

  return item;
});

export const clonePaywallContent = (
  content: PaywallContent = DEFAULT_PAYWALL_CONTENT,
): PaywallContent => ({
  settings: { ...content.settings },
  brand: { ...content.brand },
  steps: { ...content.steps },
  progressCard: { ...content.progressCard },
  intro: {
    ...content.intro,
    heroStats: cloneArray(content.intro.heroStats),
    previewRows: cloneArray(content.intro.previewRows),
  },
  reminder: {
    ...content.reminder,
    timelineItems: cloneArray(content.reminder.timelineItems),
  },
  pricing: {
    ...content.pricing,
    features: cloneArray(content.pricing.features),
    monthlyPlan: {
      ...content.pricing.monthlyPlan,
      bullets: [...content.pricing.monthlyPlan.bullets],
    },
    yearlyPlan: {
      ...content.pricing.yearlyPlan,
      bullets: [...content.pricing.yearlyPlan.bullets],
    },
  },
  legal: {
    paragraphs: [...content.legal.paragraphs],
    links: { ...content.legal.links },
  },
});

const pickString = (value: unknown, fallback: string): string =>
  typeof value === 'string' ? value : fallback;

const normalizeNumberishString = (value: string): string =>
  value.replace(/\s+/g, '').trim();

const parseNumberish = (
  value: string | null | undefined,
  fallback: number,
): number => {
  if (!value) return fallback;

  const normalized = normalizeNumberishString(value)
    .replace('€', '')
    .replace(',', '.');
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
};

const parseWholeNumberish = (
  value: string | null | undefined,
  fallback: number,
): number => {
  const parsed = Math.round(parseNumberish(value, fallback));
  return parsed > 0 ? parsed : fallback;
};

const pickStringArray = (value: unknown, fallback: string[]): string[] => {
  if (!Array.isArray(value)) {
    return [...fallback];
  }

  const next = value.filter((item): item is string => typeof item === 'string');
  return next.length > 0 ? next : [...fallback];
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sanitizeHeroStats = (value: unknown): PaywallHeroStat[] => {
  if (!Array.isArray(value)) {
    return cloneArray(DEFAULT_PAYWALL_CONTENT.intro.heroStats);
  }

  const items = value
    .map((item) => {
      if (!isRecord(item)) return null;
      return {
        value: pickString(item.value, ''),
        label: pickString(item.label, ''),
      };
    })
    .filter((item): item is PaywallHeroStat => item !== null);

  return items.length > 0
    ? items
    : cloneArray(DEFAULT_PAYWALL_CONTENT.intro.heroStats);
};

const sanitizePreviewRows = (value: unknown): PaywallPreviewRow[] => {
  if (!Array.isArray(value)) {
    return cloneArray(DEFAULT_PAYWALL_CONTENT.intro.previewRows);
  }

  const items = value
    .map((item) => {
      if (!isRecord(item)) return null;
      return {
        label: pickString(item.label, ''),
        value: pickString(item.value, ''),
      };
    })
    .filter((item): item is PaywallPreviewRow => item !== null);

  return items.length > 0
    ? items
    : cloneArray(DEFAULT_PAYWALL_CONTENT.intro.previewRows);
};

const sanitizeTimelineItems = (value: unknown): PaywallTimelineItem[] => {
  if (!Array.isArray(value)) {
    return cloneArray(DEFAULT_PAYWALL_CONTENT.reminder.timelineItems);
  }

  const items = value
    .map((item) => {
      if (!isRecord(item)) return null;
      return {
        badge: pickString(item.badge, ''),
        label: pickString(item.label, ''),
        description: pickString(item.description, ''),
      };
    })
    .filter((item): item is PaywallTimelineItem => item !== null);

  return items.length > 0
    ? items
    : cloneArray(DEFAULT_PAYWALL_CONTENT.reminder.timelineItems);
};

const sanitizeFeatureItems = (value: unknown): PaywallFeatureItem[] => {
  if (!Array.isArray(value)) {
    return cloneArray(DEFAULT_PAYWALL_CONTENT.pricing.features);
  }

  const items = value
    .map((item) => {
      if (!isRecord(item)) return null;
      return {
        badge: pickString(item.badge, ''),
        text: pickString(item.text, ''),
      };
    })
    .filter((item): item is PaywallFeatureItem => item !== null);

  return items.length > 0
    ? items
    : cloneArray(DEFAULT_PAYWALL_CONTENT.pricing.features);
};

const sanitizePlanCopy = (
  value: unknown,
  fallback: PaywallPlanCopy,
): PaywallPlanCopy => {
  const source = isRecord(value) ? value : {};
  return {
    badge: pickString(source.badge, fallback.badge),
    highlight: pickString(source.highlight, fallback.highlight),
    title: pickString(source.title, fallback.title),
    description: pickString(source.description, fallback.description),
    bullets: pickStringArray(source.bullets, fallback.bullets),
    note: pickString(source.note, fallback.note),
    buttonLabel: pickString(source.buttonLabel, fallback.buttonLabel),
    savingsInline:
      typeof fallback.savingsInline === 'string'
        ? pickString(source.savingsInline, fallback.savingsInline)
        : pickString(source.savingsInline, ''),
  };
};

export const sanitizePaywallContent = (value: unknown): PaywallContent => {
  const source = isRecord(value) ? value : {};
  const settings = isRecord(source.settings) ? source.settings : {};
  const brand = isRecord(source.brand) ? source.brand : {};
  const steps = isRecord(source.steps) ? source.steps : {};
  const progressCard = isRecord(source.progressCard) ? source.progressCard : {};
  const intro = isRecord(source.intro) ? source.intro : {};
  const reminder = isRecord(source.reminder) ? source.reminder : {};
  const pricing = isRecord(source.pricing) ? source.pricing : {};
  const legal = isRecord(source.legal) ? source.legal : {};
  const legalLinks = isRecord(legal.links) ? legal.links : {};

  return {
    settings: {
      trialDays: pickString(
        settings.trialDays,
        DEFAULT_PAYWALL_CONTENT.settings.trialDays,
      ),
      monthlyPrice: pickString(
        settings.monthlyPrice,
        DEFAULT_PAYWALL_CONTENT.settings.monthlyPrice,
      ),
      yearlyPrice: pickString(
        settings.yearlyPrice,
        DEFAULT_PAYWALL_CONTENT.settings.yearlyPrice,
      ),
    },
    brand: {
      logo: pickString(brand.logo, DEFAULT_PAYWALL_CONTENT.brand.logo),
      subtitle: pickString(
        brand.subtitle,
        DEFAULT_PAYWALL_CONTENT.brand.subtitle,
      ),
    },
    steps: {
      introEyebrow: pickString(
        steps.introEyebrow,
        DEFAULT_PAYWALL_CONTENT.steps.introEyebrow,
      ),
      reminderEyebrow: pickString(
        steps.reminderEyebrow,
        DEFAULT_PAYWALL_CONTENT.steps.reminderEyebrow,
      ),
      pricingEyebrow: pickString(
        steps.pricingEyebrow,
        DEFAULT_PAYWALL_CONTENT.steps.pricingEyebrow,
      ),
    },
    progressCard: {
      title: pickString(
        progressCard.title,
        DEFAULT_PAYWALL_CONTENT.progressCard.title,
      ),
      subtitle: pickString(
        progressCard.subtitle,
        DEFAULT_PAYWALL_CONTENT.progressCard.subtitle,
      ),
      buttonLabel: pickString(
        progressCard.buttonLabel,
        DEFAULT_PAYWALL_CONTENT.progressCard.buttonLabel,
      ),
      skipLabel: pickString(
        progressCard.skipLabel,
        DEFAULT_PAYWALL_CONTENT.progressCard.skipLabel,
      ),
    },
    intro: {
      title: pickString(intro.title, DEFAULT_PAYWALL_CONTENT.intro.title),
      subtitle: pickString(
        intro.subtitle,
        DEFAULT_PAYWALL_CONTENT.intro.subtitle,
      ),
      summary: pickString(intro.summary, DEFAULT_PAYWALL_CONTENT.intro.summary),
      miniBenefit: pickString(
        intro.miniBenefit,
        DEFAULT_PAYWALL_CONTENT.intro.miniBenefit,
      ),
      heroDealNote: pickString(
        intro.heroDealNote,
        DEFAULT_PAYWALL_CONTENT.intro.heroDealNote,
      ),
      heroTitle: pickString(
        intro.heroTitle,
        DEFAULT_PAYWALL_CONTENT.intro.heroTitle,
      ),
      heroSubtitle: pickString(
        intro.heroSubtitle,
        DEFAULT_PAYWALL_CONTENT.intro.heroSubtitle,
      ),
      heroStats: sanitizeHeroStats(intro.heroStats),
      previewRows: sanitizePreviewRows(intro.previewRows),
    },
    reminder: {
      title: pickString(
        reminder.title,
        DEFAULT_PAYWALL_CONTENT.reminder.title,
      ),
      subtitle: pickString(
        reminder.subtitle,
        DEFAULT_PAYWALL_CONTENT.reminder.subtitle,
      ),
      timelineItems: sanitizeTimelineItems(reminder.timelineItems),
    },
    pricing: {
      title: pickString(pricing.title, DEFAULT_PAYWALL_CONTENT.pricing.title),
      subtitle: pickString(
        pricing.subtitle,
        DEFAULT_PAYWALL_CONTENT.pricing.subtitle,
      ),
      socialProof: pickString(
        pricing.socialProof,
        DEFAULT_PAYWALL_CONTENT.pricing.socialProof,
      ),
      featureTitle: pickString(
        pricing.featureTitle,
        DEFAULT_PAYWALL_CONTENT.pricing.featureTitle,
      ),
      features: sanitizeFeatureItems(pricing.features),
      monthlyPlan: sanitizePlanCopy(
        pricing.monthlyPlan,
        DEFAULT_PAYWALL_CONTENT.pricing.monthlyPlan,
      ),
      yearlyPlan: sanitizePlanCopy(
        pricing.yearlyPlan,
        DEFAULT_PAYWALL_CONTENT.pricing.yearlyPlan,
      ),
      restoreLabel: pickString(
        pricing.restoreLabel,
        DEFAULT_PAYWALL_CONTENT.pricing.restoreLabel,
      ),
      cancelLabel: pickString(
        pricing.cancelLabel,
        DEFAULT_PAYWALL_CONTENT.pricing.cancelLabel,
      ),
    },
    legal: {
      paragraphs: pickStringArray(
        legal.paragraphs,
        DEFAULT_PAYWALL_CONTENT.legal.paragraphs,
      ),
      links: {
        privacy: pickString(
          legalLinks.privacy,
          DEFAULT_PAYWALL_CONTENT.legal.links.privacy,
        ),
        terms: pickString(
          legalLinks.terms,
          DEFAULT_PAYWALL_CONTENT.legal.links.terms,
        ),
        appleEula: pickString(
          legalLinks.appleEula,
          DEFAULT_PAYWALL_CONTENT.legal.links.appleEula,
        ),
        imprint: pickString(
          legalLinks.imprint,
          DEFAULT_PAYWALL_CONTENT.legal.links.imprint,
        ),
        dataManagement: pickString(
          legalLinks.dataManagement,
          DEFAULT_PAYWALL_CONTENT.legal.links.dataManagement,
        ),
      },
    },
  };
};

export const formatEuroAmount = (value: number) =>
  `${value.toFixed(2).replace('.', ',')} €`;

export const getPaywallTrialDays = (content: PaywallContent): number =>
  parseWholeNumberish(content.settings.trialDays, DEFAULT_PAYWALL_TRIAL_DAYS);

export const getPaywallTemplateValues = (
  settings: PaywallContentSettings,
  billingLabel: string,
): PaywallTemplateValues => {
  const trialDaysNumber = parseWholeNumberish(
    settings.trialDays,
    DEFAULT_PAYWALL_TRIAL_DAYS,
  );
  const monthlyPrice = parseNumberish(
    settings.monthlyPrice,
    DEFAULT_DISPLAY_MONTHLY_PRICE,
  );
  const yearlyPrice = parseNumberish(
    settings.yearlyPrice,
    DEFAULT_DISPLAY_YEARLY_PRICE,
  );
  const monthlyDisplayPrice = formatEuroAmount(monthlyPrice);
  const yearlyDisplayPrice = formatEuroAmount(yearlyPrice);
  const yearlySavings = formatEuroAmount(
    Math.max(0, monthlyPrice * 12 - yearlyPrice),
  );

  return {
    appName: 'Lotti Baby',
    trialDays: `${trialDaysNumber} Tage`,
    trialDaysAfter: `${trialDaysNumber} Tagen`,
    trialDaysNumber: `${trialDaysNumber}`,
    trialDaysPlusOne: `${trialDaysNumber + 1}`,
    monthlyDisplayPrice,
    yearlyDisplayPrice,
    monthlyPriceText: `${monthlyDisplayPrice} pro Monat`,
    yearlyPriceText: `${yearlyDisplayPrice} pro Jahr`,
    billingLabel,
    yearlySavings,
  };
};

const applyTemplate = (
  value: string,
  variables: PaywallTemplateValues,
): string =>
  value.replace(/\{\{(\w+)\}\}/g, (_match, key: keyof PaywallTemplateValues) => {
    return variables[key] ?? '';
  });

export const resolvePaywallContent = (
  content: PaywallContent,
  variables: PaywallTemplateValues,
): PaywallContent => {
  const source = sanitizePaywallContent(content);

  return {
    settings: { ...source.settings },
    brand: {
      logo: applyTemplate(source.brand.logo, variables),
      subtitle: applyTemplate(source.brand.subtitle, variables),
    },
    steps: {
      introEyebrow: applyTemplate(source.steps.introEyebrow, variables),
      reminderEyebrow: applyTemplate(source.steps.reminderEyebrow, variables),
      pricingEyebrow: applyTemplate(source.steps.pricingEyebrow, variables),
    },
    progressCard: {
      title: applyTemplate(source.progressCard.title, variables),
      subtitle: applyTemplate(source.progressCard.subtitle, variables),
      buttonLabel: applyTemplate(source.progressCard.buttonLabel, variables),
      skipLabel: applyTemplate(source.progressCard.skipLabel, variables),
    },
    intro: {
      title: applyTemplate(source.intro.title, variables),
      subtitle: applyTemplate(source.intro.subtitle, variables),
      summary: applyTemplate(source.intro.summary, variables),
      miniBenefit: applyTemplate(source.intro.miniBenefit, variables),
      heroDealNote: applyTemplate(source.intro.heroDealNote, variables),
      heroTitle: applyTemplate(source.intro.heroTitle, variables),
      heroSubtitle: applyTemplate(source.intro.heroSubtitle, variables),
      heroStats: source.intro.heroStats.map((item) => ({
        value: applyTemplate(item.value, variables),
        label: applyTemplate(item.label, variables),
      })),
      previewRows: source.intro.previewRows.map((item) => ({
        label: applyTemplate(item.label, variables),
        value: applyTemplate(item.value, variables),
      })),
    },
    reminder: {
      title: applyTemplate(source.reminder.title, variables),
      subtitle: applyTemplate(source.reminder.subtitle, variables),
      timelineItems: source.reminder.timelineItems.map((item) => ({
        badge: applyTemplate(item.badge, variables),
        label: applyTemplate(item.label, variables),
        description: applyTemplate(item.description, variables),
      })),
    },
    pricing: {
      title: applyTemplate(source.pricing.title, variables),
      subtitle: applyTemplate(source.pricing.subtitle, variables),
      socialProof: applyTemplate(source.pricing.socialProof, variables),
      featureTitle: applyTemplate(source.pricing.featureTitle, variables),
      features: source.pricing.features.map((item) => ({
        badge: applyTemplate(item.badge, variables),
        text: applyTemplate(item.text, variables),
      })),
      monthlyPlan: {
        ...source.pricing.monthlyPlan,
        badge: applyTemplate(source.pricing.monthlyPlan.badge, variables),
        highlight: applyTemplate(
          source.pricing.monthlyPlan.highlight,
          variables,
        ),
        title: applyTemplate(source.pricing.monthlyPlan.title, variables),
        description: applyTemplate(
          source.pricing.monthlyPlan.description,
          variables,
        ),
        bullets: source.pricing.monthlyPlan.bullets.map((item) =>
          applyTemplate(item, variables),
        ),
        note: applyTemplate(source.pricing.monthlyPlan.note, variables),
        buttonLabel: applyTemplate(
          source.pricing.monthlyPlan.buttonLabel,
          variables,
        ),
      },
      yearlyPlan: {
        ...source.pricing.yearlyPlan,
        badge: applyTemplate(source.pricing.yearlyPlan.badge, variables),
        highlight: applyTemplate(
          source.pricing.yearlyPlan.highlight,
          variables,
        ),
        title: applyTemplate(source.pricing.yearlyPlan.title, variables),
        description: applyTemplate(
          source.pricing.yearlyPlan.description,
          variables,
        ),
        bullets: source.pricing.yearlyPlan.bullets.map((item) =>
          applyTemplate(item, variables),
        ),
        note: applyTemplate(source.pricing.yearlyPlan.note, variables),
        buttonLabel: applyTemplate(
          source.pricing.yearlyPlan.buttonLabel,
          variables,
        ),
        savingsInline: applyTemplate(
          source.pricing.yearlyPlan.savingsInline ?? '',
          variables,
        ),
      },
      restoreLabel: applyTemplate(source.pricing.restoreLabel, variables),
      cancelLabel: applyTemplate(source.pricing.cancelLabel, variables),
    },
    legal: {
      paragraphs: source.legal.paragraphs.map((item) =>
        applyTemplate(item, variables),
      ),
      links: {
        privacy: applyTemplate(source.legal.links.privacy, variables),
        terms: applyTemplate(source.legal.links.terms, variables),
        appleEula: applyTemplate(source.legal.links.appleEula, variables),
        imprint: applyTemplate(source.legal.links.imprint, variables),
        dataManagement: applyTemplate(
          source.legal.links.dataManagement,
          variables,
        ),
      },
    },
  };
};

export const fetchPaywallContent = async (): Promise<PaywallContentRecord> => {
  const { data, error } = await supabase
    .from('paywall_content_config')
    .select('content,updated_at')
    .eq('id', PAYWALL_CONTENT_CONFIG_ID)
    .maybeSingle();

  if (error) {
    throw error;
  }

  return {
    content: sanitizePaywallContent(data?.content),
    updatedAt: data?.updated_at ?? null,
  };
};

let paywallContentCache: PaywallContentRecord | null = null;
let paywallContentCacheAt = 0;
const PAYWALL_CONTENT_CACHE_DURATION_MS = 5 * 60 * 1000;

export const invalidatePaywallContentCache = () => {
  paywallContentCache = null;
  paywallContentCacheAt = 0;
};

export const getCachedPaywallContent = async (): Promise<PaywallContentRecord> => {
  const now = Date.now();
  if (
    paywallContentCache &&
    now - paywallContentCacheAt < PAYWALL_CONTENT_CACHE_DURATION_MS
  ) {
    return paywallContentCache;
  }

  const record = await fetchPaywallContent();
  paywallContentCache = record;
  paywallContentCacheAt = now;
  return record;
};

export const savePaywallContent = async (
  content: PaywallContent,
  updatedBy: string | null,
): Promise<PaywallContentRecord> => {
  const payload = sanitizePaywallContent(content);
  const { data, error } = await supabase
    .from('paywall_content_config')
    .upsert(
      {
        id: PAYWALL_CONTENT_CONFIG_ID,
        content: payload,
        updated_by: updatedBy,
      },
      { onConflict: 'id' },
    )
    .select('content,updated_at')
    .single();

  if (error) {
    throw error;
  }

  const record = {
    content: sanitizePaywallContent(data?.content),
    updatedAt: data?.updated_at ?? null,
  };
  paywallContentCache = record;
  paywallContentCacheAt = Date.now();
  return record;
};

export const subscribeToPaywallContent = (
  onChange: (record: PaywallContentRecord) => void,
  onError?: (error: unknown) => void,
): RealtimeChannel =>
  supabase
    .channel('paywall-content-config')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'paywall_content_config',
        filter: `id=eq.${PAYWALL_CONTENT_CONFIG_ID}`,
      },
      () => {
        void fetchPaywallContent()
          .then((record) => {
            paywallContentCache = record;
            paywallContentCacheAt = Date.now();
            onChange(record);
          })
          .catch((error) => {
            onError?.(error);
          });
      },
    )
    .subscribe();

export const unsubscribePaywallContent = async (
  channel: RealtimeChannel | null,
) => {
  if (!channel) return;
  await channel.unsubscribe();
};
