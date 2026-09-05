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

export const inferCustomActivityEmoji = (name: string): string => {
  const normalized = normalizeActivityName(name);
  return (
    EMOJI_RULES.find((rule) => rule.keywords.some((keyword) => normalized.includes(keyword)))
      ?.emoji ?? '✨'
  );
};

const EMOJI_LIKE_RE = /\p{Extended_Pictographic}|\p{Regional_Indicator}|[#*0-9]\uFE0F?\u20E3/u;

/** Nimmt nur ein tatsaechliches Emoji aus der Modellausgabe; Text wird verworfen. */
export const sanitizeNewCustomActivityEmoji = (value: unknown, activityName: string): string => {
  if (typeof value === 'string') {
    const segments = new Intl.Segmenter(undefined, { granularity: 'grapheme' }).segment(
      value.normalize('NFC').trim(),
    );
    for (const { segment } of segments) {
      if (EMOJI_LIKE_RE.test(segment)) {
        return Array.from(segment).slice(0, 16).join('');
      }
    }
  }
  return inferCustomActivityEmoji(activityName);
};
