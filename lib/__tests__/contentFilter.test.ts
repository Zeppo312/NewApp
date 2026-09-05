import {
  CONTENT_BLOCKED_ERROR,
  buildContentBlockedError,
  checkContent,
  isContentBlocked,
  isContentBlockedError,
  normalizeForFilter,
} from '../contentFilter';

describe('content filter', () => {
  it('lässt normale Elterngespräche unangetastet', () => {
    const harmlessTexts = [
      'Mein Baby schläft seit drei Wochen endlich durch.',
      'Wie lange habt ihr gestillt? Ich bin gerade echt am Ende.',
      'Der Kinderarzt meinte, die Gewichtskurve sieht super aus.',
      'Nach der Geburt hatte ich starke Schmerzen im Beckenboden.',
      'We had a rough night, she was crying for hours.',
      'Mi bebé tiene cólicos por la noche.',
    ];

    harmlessTexts.forEach((text) => {
      expect(checkContent(text)).toEqual({ ok: true });
    });
  });

  it('blockiert eindeutige Beschimpfungen', () => {
    const result = checkContent('Du bist ein Hurensohn');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.severity).toBe('block');
      expect(result.matchedTerm).toBe('hurensohn');
    }
    expect(isContentBlocked('Du bist ein Hurensohn')).toBe(true);
  });

  it('erkennt Leetspeak und Sonderzeichen', () => {
    expect(isContentBlocked('du hur3ns0hn')).toBe(true);
    expect(isContentBlocked('N1GGER')).toBe(true);
  });

  it('erkennt auseinandergezogene Schreibweisen bei langen Begriffen', () => {
    expect(isContentBlocked('h u r e n s o h n')).toBe(true);
    expect(isContentBlocked('k-i-l-l y-o-u-r-s-e-l-f')).toBe(true);
  });

  it('markiert weichere Treffer nur als Warnung', () => {
    const result = checkContent('So ein Arschloch');
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.severity).toBe('warn');
    }
    // Warnungen dürfen das Absenden nicht verhindern.
    expect(isContentBlocked('So ein Arschloch')).toBe(false);
  });

  it('respektiert Wortgrenzen', () => {
    // "hure" darf nicht in "Uhrenkette" oder "Führung" anspringen.
    expect(checkContent('Meine Uhrenkette ist gerissen')).toEqual({ ok: true });
    expect(checkContent('Die Führung war interessant')).toEqual({ ok: true });
  });

  it('behandelt leere Eingaben als unbedenklich', () => {
    expect(checkContent('')).toEqual({ ok: true });
    expect(checkContent('   ')).toEqual({ ok: true });
    expect(checkContent(null)).toEqual({ ok: true });
    expect(checkContent(undefined)).toEqual({ ok: true });
  });

  it('normalisiert Umlaute, Akzente und Leetspeak', () => {
    expect(normalizeForFilter('MÜLLER')).toBe('muller');
    expect(normalizeForFilter('Straße')).toBe('strasse');
    expect(normalizeForFilter('h4ll0')).toBe('hallo');
    expect(normalizeForFilter('maricón')).toBe('maricon');
  });

  it('erkennt Filter-Fehler aus Client und Server', () => {
    expect(isContentBlockedError(buildContentBlockedError())).toBe(true);
    expect(isContentBlockedError({ message: CONTENT_BLOCKED_ERROR })).toBe(true);
    expect(isContentBlockedError({ hint: 'moderation_filter' })).toBe(true);
    expect(
      isContentBlockedError({ message: 'content rejected by moderation filter' }),
    ).toBe(true);
    expect(isContentBlockedError({ message: 'network error' })).toBe(false);
    expect(isContentBlockedError(null)).toBe(false);
  });
});
