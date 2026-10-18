import { getShoppingSuggestions } from '../shoppingSuggestions';

const item = (title: string, day = 1, purchased = true) => ({
  title,
  is_purchased: purchased,
  updated_at: `2026-09-0${day}T12:00:00Z`,
});

describe('shopping suggestions', () => {
  it('shows only purchased items, newest first, without changing the input array', () => {
    const items = [item('Milch'), item('Brot', 2), item('Äpfel', 3, false)];
    expect(getShoppingSuggestions(items, '').map((entry) => entry.title)).toEqual(['Brot', 'Milch']);
    expect(items[0].title).toBe('Milch');
  });

  it('narrows matches regardless of case and whitespace, with prefixes first', () => {
    const items = [item('Hafermilch', 3), item('Milch'), item('Milchreis', 2)];
    expect(getShoppingSuggestions(items, ' MILCH ').map((entry) => entry.title))
      .toEqual(['Milchreis', 'Milch', 'Hafermilch']);
    expect(getShoppingSuggestions(items, 'milchr').map((entry) => entry.title)).toEqual(['Milchreis']);
    expect(getShoppingSuggestions(items, 'Brot')).toEqual([]);
  });

  it('keeps the newest duplicate and limits the list to five suggestions', () => {
    const newest = item('  MILCH  ', 4);
    expect(getShoppingSuggestions([item('Milch'), newest], '')).toEqual([newest]);
    expect(getShoppingSuggestions(Array.from({ length: 8 }, (_, index) => item(`Posten ${index}`)), ''))
      .toHaveLength(5);
  });
});
