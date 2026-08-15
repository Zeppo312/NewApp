import type { AskLottiLocale } from "./guardrails.ts";
import type { AskLottiDomain } from "./planner.ts";

// Without an age-appropriate anchor a figure like "5.9 h" tells a parent
// nothing — they cannot tell a tracking gap from a real problem. These are the
// widely published general orientation ranges (AASM/NSF consensus), computed
// server-side so the answer model never has to recall or invent them, and so
// the number guardrail accepts them as grounded.
export type ReferenceRange = {
  domain: AskLottiDomain;
  label: string;
  detail: string;
};

type SleepBand = {
  maxMonths: number;
  totalLow: number;
  totalHigh: number;
  naps: string;
};

const SLEEP_BANDS: SleepBand[] = [
  { maxMonths: 4, totalLow: 14, totalHigh: 17, naps: "4-5" },
  { maxMonths: 9, totalLow: 12, totalHigh: 15, naps: "3" },
  { maxMonths: 12, totalLow: 12, totalHigh: 15, naps: "2" },
  { maxMonths: 18, totalLow: 11, totalHigh: 14, naps: "1-2" },
  { maxMonths: 36, totalLow: 11, totalHigh: 14, naps: "1" },
  { maxMonths: 72, totalLow: 10, totalHigh: 13, naps: "0-1" },
  {
    maxMonths: Number.POSITIVE_INFINITY,
    totalLow: 9,
    totalHigh: 12,
    naps: "0",
  },
];

const sleepCopy = (
  locale: AskLottiLocale,
  band: SleepBand,
  ageMonths: number,
): ReferenceRange => ({
  domain: "sleep",
  label:
    locale === "de"
      ? `Übliche Schlafmenge mit ${ageMonths} Monaten`
      : locale === "es"
        ? `Sueño habitual a los ${ageMonths} meses`
        : `Typical sleep at ${ageMonths} months`,
  detail:
    locale === "de"
      ? `${band.totalLow}–${band.totalHigh} Std. pro 24 Std., davon ${band.naps} Nickerchen`
      : locale === "es"
        ? `${band.totalLow}–${band.totalHigh} h por 24 h, con ${band.naps} siestas`
        : `${band.totalLow}–${band.totalHigh} h per 24 h, including ${band.naps} naps`,
});

export const referenceRanges = (
  domains: AskLottiDomain[],
  ageMonths: number | null,
  locale: AskLottiLocale,
): ReferenceRange[] => {
  if (ageMonths === null || ageMonths < 0) return [];
  const ranges: ReferenceRange[] = [];
  if (domains.includes("sleep")) {
    const band = SLEEP_BANDS.find((entry) => ageMonths < entry.maxMonths);
    if (band) ranges.push(sleepCopy(locale, band, ageMonths));
  }
  return ranges;
};
