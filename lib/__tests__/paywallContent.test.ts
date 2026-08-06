import { DEFAULT_PAYWALL_CONTENT, sanitizePaywallContent } from '../paywallContent';
import { localizePaywallPlansContent } from '../paywallTranslations';

const allTiers = { lite: true, standard: true, premium: true };
const standardAndPremium = { lite: false, standard: true, premium: true };
const premiumOnly = { lite: false, standard: false, premium: true };

describe('paywall feature comparison', () => {
  const germanRows = DEFAULT_PAYWALL_CONTENT.plans.comparisonRows;

  it('lists every current feature group exactly once', () => {
    expect(germanRows).toHaveLength(25);
    expect(new Set(germanRows.map(({ label }) => label)).size).toBe(germanRows.length);

    expect(germanRows.map(({ label }) => label)).toEqual(
      expect.arrayContaining([
        'Schlaftracker, Schlafphasen & Schlafprognosen',
        'Stillen, Flasche, Pumpen, Beikost & Wasser',
        'Kliniktaschen-Checkliste, Geburtsplan & Arztfragen',
        'Meilensteine, Zahn-Tracker & Fotobuch als PDF',
        'Babywetter & Kleidungsempfehlungen',
        'Community, Gruppen & private Chats',
        'Einkaufslisten, Vorräte, Warnungen & Kundenkarten',
        'Rezepte, Generator, eigene Rezepte & Beikost-Videos',
        '✨ Persönliches Schwangerschafts-Briefing',
        '✨ KI: Sprach-Logging – Einträge einsprechen',
        '✨ KI: Lottis Fürsorge – tägliche Hinweise',
        '✨ KI: Frag Lotti – belegte Antworten aus euren Daten',
      ]),
    );
  });

  it('keeps the tier differences accurate', () => {
    expect(germanRows.slice(0, 14)).toEqual(
      germanRows.slice(0, 14).map((row) => ({ ...row, ...allTiers })),
    );
    expect(germanRows.slice(14, 21)).toEqual(
      germanRows.slice(14, 21).map((row) => ({ ...row, ...standardAndPremium })),
    );
    expect(germanRows.slice(21)).toEqual(
      germanRows.slice(21).map((row) => ({ ...row, ...premiumOnly })),
    );
  });

  it('provides the complete comparison in every supported language', () => {
    const english = localizePaywallPlansContent('en', DEFAULT_PAYWALL_CONTENT.plans);
    const spanish = localizePaywallPlansContent('es', DEFAULT_PAYWALL_CONTENT.plans);

    expect(english.comparisonRows).toHaveLength(germanRows.length);
    expect(spanish.comparisonRows).toHaveLength(germanRows.length);
    expect(english.comparisonRows.at(-1)?.label).toBe(
      '✨ AI: Ask Lotti – evidence-backed answers from your data',
    );
    expect(spanish.comparisonRows.at(-1)?.label).toBe(
      '✨ IA: Pregunta a Lotti – respuestas basadas en tus datos',
    );
    expect(english.comparisonRows.map(({ lite, standard, premium }) => ({ lite, standard, premium })))
      .toEqual(germanRows.map(({ lite, standard, premium }) => ({ lite, standard, premium })));
    expect(spanish.comparisonRows.map(({ lite, standard, premium }) => ({ lite, standard, premium })))
      .toEqual(germanRows.map(({ lite, standard, premium }) => ({ lite, standard, premium })));
  });

  it('uses the complete defaults for older saved content without plan rows', () => {
    expect(sanitizePaywallContent({}).plans.comparisonRows).toEqual(germanRows);
  });
});
