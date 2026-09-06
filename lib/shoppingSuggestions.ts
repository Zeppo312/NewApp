type SuggestionItem = {
  title: string;
  is_purchased: boolean;
  updated_at: string;
};

const normalize = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ');

/** Recent purchased titles, deduplicated and narrowed as the user types. */
export function getShoppingSuggestions<T extends SuggestionItem>(items: T[], input: string): T[] {
  const query = normalize(input);
  const seen = new Set<string>();
  return items
    .filter((item) => item.is_purchased && normalize(item.title).includes(query))
    .sort((a, b) => {
      const prefixMatch = Number(normalize(b.title).startsWith(query)) -
        Number(normalize(a.title).startsWith(query));
      return prefixMatch || Date.parse(b.updated_at) - Date.parse(a.updated_at);
    })
    .filter((item) => {
      const title = normalize(item.title);
      if (!title || seen.has(title)) return false;
      seen.add(title);
      return true;
    })
    .slice(0, 5);
}
