import { canEncodeCode128, code128Checksum, createCode128Layout } from '../code-128';

describe('Code 128', () => {
  it('akzeptiert Kartennummern und druckbare ASCII-Zeichen', () => {
    expect(canEncodeCode128('1234567890123')).toBe(true);
    expect(canEncodeCode128('CARD-42')).toBe(true);
    expect(canEncodeCode128('Karte ä')).toBe(false);
    expect(canEncodeCode128('')).toBe(false);
  });

  it('berechnet die Code-128-B-Prüfsumme', () => {
    expect(code128Checksum('AB')).toBe(102);
  });

  it('liefert Balken mit Ruhezone auf beiden Seiten', () => {
    const layout = createCode128Layout('1234');
    expect(layout.bars.length).toBeGreaterThan(0);
    expect(layout.bars[0].x).toBe(10);
    expect(layout.width).toBeGreaterThan(layout.bars.at(-1)!.x + layout.bars.at(-1)!.width);
  });
});
