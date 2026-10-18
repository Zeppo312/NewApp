import {
  inferCustomActivityEmoji,
  normalizeCustomActivityEmoji,
} from '../customActivityEmoji';
import {
  inferCustomActivityEmoji as inferEdgeCustomActivityEmoji,
  sanitizeNewCustomActivityEmoji,
} from '../../supabase/functions/_shared/customActivityEmoji';

describe('custom activity emoji selection', () => {
  it.each([
    ['Backen', '🧑‍🍳'],
    ['Vitamin D geben', '💊'],
    ['Spaziergang', '🚶'],
    ['Bücher lesen', '📖'],
    ['Schwimmen', '🏊'],
  ])('maps %s to a contextual emoji', (name, emoji) => {
    expect(inferCustomActivityEmoji(name)).toBe(emoji);
    expect(inferEdgeCustomActivityEmoji(name)).toBe(emoji);
  });

  it('uses a neutral non-star fallback for an unknown activity', () => {
    expect(inferCustomActivityEmoji('Wichtelzeit')).toBe('✨');
  });

  it('preserves a complex explicitly selected emoji', () => {
    expect(normalizeCustomActivityEmoji('👨🏿‍🍼', 'Fuettern')).toBe('👨🏿‍🍼');
    expect(sanitizeNewCustomActivityEmoji('👨🏿‍🍼', 'Fuettern')).toBe('👨🏿‍🍼');
  });

  it('replaces non-emoji model output with the contextual fallback', () => {
    expect(sanitizeNewCustomActivityEmoji('Koch', 'Backen')).toBe('🧑‍🍳');
  });
});
