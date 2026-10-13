const EMOJI_RULES: readonly { emoji: string; keywords: readonly string[] }[] = [
  { emoji: '🧑‍🍳', keywords: ['back', 'kuchen', 'keks', 'koch', 'cook', 'bake', 'horne', 'cocin'] },
  { emoji: '💊', keywords: ['medizin', 'medikament', 'vitamin', 'tropfen', 'medicine', 'medication', 'drop', 'medicina', 'medicamento', 'gota'] },
  { emoji: '🛁', keywords: ['baden', 'bad', 'bath', 'bano', 'duchen', 'shower', 'ducha'] },
  { emoji: '🚶', keywords: ['spazier', 'laufen', 'walk', 'stroll', 'paseo', 'caminar'] },
  { emoji: '🌳', keywords: ['garten', 'drau', 'outdoor', 'garden', 'outside', 'parque', 'fuera'] },
  { emoji: '🏊', keywords: ['schwimm', 'swim', 'natacion', 'nadar'] },
  { emoji: '🤸', keywords: ['sport', 'turn', 'gymnast', 'yoga', 'exercise', 'workout', 'ejercicio'] },
  { emoji: '📖', keywords: ['lesen', 'buch', 'read', 'book', 'leer', 'libro'] },
  { emoji: '🎵', keywords: ['musik', 'sing', 'lied', 'music', 'song', 'cantar', 'musica'] },
  { emoji: '🧸', keywords: ['spiel', 'play', 'jugar', 'juego'] },
  { emoji: '🦷', keywords: ['zahn', 'zahne', 'tooth', 'teeth', 'diente'] },
  { emoji: '🪥', keywords: ['putzen', 'burste', 'brush', 'cepill'] },
  { emoji: '💆', keywords: ['massage', 'massier', 'masaje'] },
  { emoji: '📸', keywords: ['foto', 'photo', 'picture', 'bild'] },
  { emoji: '🎨', keywords: ['malen', 'zeichn', 'bastel', 'paint', 'draw', 'craft', 'pintar', 'dibuj'] },
  { emoji: '👶', keywords: ['bauchlage', 'tummy', 'krabbel', 'crawl', 'gatear'] },
];

const normalizeActivityName = (value: string): string =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLocaleLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();

/** Kontextuelles Fallback, falls der Sprachparser kein Emoji geliefert hat. */
export const inferCustomActivityEmoji = (name: string): string => {
  const normalized = normalizeActivityName(name);
  return (
    EMOJI_RULES.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)))
      ?.emoji ?? '✨'
  );
};

/** Erhaelt auch ZWJ-/Hautton-Emoji und begrenzt nach Unicode-Codepoints. */
export const normalizeCustomActivityEmoji = (
  value: string | null | undefined,
  activityName: string,
): string => {
  const normalized = Array.from((value ?? '').normalize('NFC').trim()).slice(0, 16).join('');
  return normalized || inferCustomActivityEmoji(activityName);
};
