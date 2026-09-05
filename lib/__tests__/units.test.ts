import { formatUnitQuantity, parseUnitQuantity } from '../units';

describe('formatUnitQuantity', () => {
  it('rechnet ab 1000 g/ml in kg bzw. l hoch', () => {
    expect(formatUnitQuantity(1200, 'g')).toBe('1,2 kg');
    expect(formatUnitQuantity(1000, 'ml')).toBe('1 l');
    expect(formatUnitQuantity(2500, 'ml')).toBe('2,5 l');
  });

  it('lässt kleine Mengen und Stück-Einheiten unverändert', () => {
    expect(formatUnitQuantity(540, 'g')).toBe('540 g');
    expect(formatUnitQuantity(5, 'Stück')).toBe('5 Stück');
    expect(formatUnitQuantity(0, 'g')).toBe('0 g');
  });

  it('formatiert Dezimalzahlen deutsch mit maximal 2 Nachkommastellen', () => {
    expect(formatUnitQuantity(17.85, 'g')).toBe('17,85 g');
    expect(formatUnitQuantity(1234.5, 'g')).toBe('1,23 kg');
  });
});

describe('parseUnitQuantity', () => {
  it('normalisiert kg und l auf die Basiseinheit', () => {
    expect(parseUnitQuantity('1,2', 'kg')).toEqual({ value: 1200, unit: 'g' });
    expect(parseUnitQuantity('0.5', 'l')).toEqual({ value: 500, unit: 'ml' });
  });

  it('lässt Basiseinheiten und unbekannte Einheiten unverändert', () => {
    expect(parseUnitQuantity('800', 'g')).toEqual({ value: 800, unit: 'g' });
    expect(parseUnitQuantity('5', 'Stück')).toEqual({ value: 5, unit: 'Stück' });
  });

  it('liefert null für ungültige Werte', () => {
    expect(parseUnitQuantity('abc', 'g')).toBeNull();
    expect(parseUnitQuantity('', 'g')).toBeNull();
  });
});
