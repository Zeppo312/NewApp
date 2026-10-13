import { adaptPlannerColor, normalizePlannerColor } from '@/constants/PlannerColors';

/**
 * Personenfarben des Planers – eine Quelle für Planer-Screen und Widget.
 *
 * Ohne eigene Eintragsfarbe bekommt ein Termin die Farbe der Person, für die
 * er gilt: Ich, Partner, Baby (nach Geschlecht aus einer kleinen Palette) oder
 * Familie. Die Zuordnung war vorher nur im Planer-Screen berechnet; das
 * Home-Screen-Widget braucht dieselben Farben, sonst sähe derselbe Termin dort
 * anders aus als in der App.
 */

export const PLANNER_SELF_COLOR = '#D97A2F';
export const PLANNER_PARTNER_COLOR = '#6E4DBD';
const BOY_PALETTE = ['#4F7FCE', '#4CA174', '#369C93'];
const GIRL_PALETTE = ['#E49AB8', '#C45243', '#CC6F96'];
const NEUTRAL_BABY_PALETTE = ['#4D8DBF', '#7EA63F'];

export const lightenPlannerHex = (hex: string, amount = 0.25) => {
  const cleanHex = hex.replace('#', '');
  const int = parseInt(cleanHex, 16);
  const r = (int >> 16) & 255;
  const g = (int >> 8) & 255;
  const b = int & 255;
  const lightenChannel = (channel: number) =>
    Math.min(255, Math.round(channel + (255 - channel) * amount));
  const toHex = (channel: number) => channel.toString(16).padStart(2, '0');
  return `#${toHex(lightenChannel(r))}${toHex(lightenChannel(g))}${toHex(lightenChannel(b))}`;
};

export type PlannerPersonBaby = { id?: string | null; baby_gender?: string | null };

export type PlannerPersonColorInput = {
  userId?: string | null;
  linkedUserIds: string[];
  babies: PlannerPersonBaby[];
  /** Farbe für „Familie“ – im Screen der Theme-Akzent. */
  accentColor: string;
  /** Im Dunkelmodus hellt der Screen die Personenfarben leicht auf. */
  isDark?: boolean;
};

/** Schlüssel → Farbe, z. B. `user:<id>`, `baby:<id>`, `family`, `partner`, `child`. */
export function buildPlannerPersonColorMap(input: PlannerPersonColorInput): Record<string, string> {
  const { userId, linkedUserIds, babies, accentColor, isDark = false } = input;
  const map: Record<string, string> = {};
  const tint = (hex: string) => (isDark ? lightenPlannerHex(hex, 0.08) : hex);

  const selfColor = tint(PLANNER_SELF_COLOR);
  const partnerColor = tint(PLANNER_PARTNER_COLOR);
  const boyPalette = BOY_PALETTE.map(tint);
  const girlPalette = GIRL_PALETTE.map(tint);
  const neutralPalette = NEUTRAL_BABY_PALETTE.map(tint);

  if (userId) map[`user:${userId}`] = selfColor;
  linkedUserIds.forEach((id) => {
    map[`user:${id}`] = partnerColor;
  });

  let boyIndex = 0;
  let girlIndex = 0;
  let neutralIndex = 0;
  babies.forEach((baby) => {
    if (!baby.id) return;
    const gender = String(baby.baby_gender ?? 'unknown').toLowerCase();
    let color = neutralPalette[neutralIndex % neutralPalette.length];
    if (gender === 'male') {
      color = boyPalette[boyIndex % boyPalette.length];
      boyIndex += 1;
    } else if (gender === 'female') {
      color = girlPalette[girlIndex % girlPalette.length];
      girlIndex += 1;
    } else {
      neutralIndex += 1;
    }
    map[`baby:${baby.id}`] = color;
  });

  const partnerUserId = linkedUserIds.find((id) => id !== userId);
  map.family = accentColor;
  map.partner = partnerUserId ? map[`user:${partnerUserId}`] ?? partnerColor : partnerColor;
  map.child =
    babies.length > 0 && babies[0]?.id
      ? map[`baby:${babies[0].id}`] ?? boyPalette[0]
      : boyPalette[0];

  return map;
}

/** Welche Person „besitzt“ den Eintrag farblich? */
export function getPlannerPersonKey(
  item: { assignee?: string | null; babyId?: string | null; ownerId?: string | null },
  context: { userId?: string | null; partnerUserId?: string | null },
): string {
  const { assignee, babyId, ownerId } = item;
  if (assignee === 'child') return babyId ? `baby:${babyId}` : 'child';
  if (assignee === 'family') return 'family';
  if (assignee === 'partner') return context.partnerUserId ? `user:${context.partnerUserId}` : 'partner';
  if (ownerId) return `user:${ownerId}`;
  if (context.userId) return `user:${context.userId}`;
  return 'default';
}

/**
 * Farbe eines Eintrags: eigene Farbe vor Personenfarbe vor Fallback.
 * `isDark` passt nur die eigene Farbe an (wie adaptPlannerColor); die
 * Personenfarben aus `buildPlannerPersonColorMap` sind schon Theme-fertig.
 */
export function resolvePlannerItemColor(
  item: { assignee?: string | null; babyId?: string | null; ownerId?: string | null; color?: string | null },
  colorMap: Record<string, string>,
  context: { userId?: string | null; partnerUserId?: string | null; isDark?: boolean; fallback: string },
): string {
  const custom = normalizePlannerColor(item.color);
  if (custom) return adaptPlannerColor(custom, context.isDark ?? false);
  const key = getPlannerPersonKey(item, context);
  return colorMap[key] ?? context.fallback;
}
