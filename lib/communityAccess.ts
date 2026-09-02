/**
 * Zentraler Schalter für die nutzergenerierten Bereiche: Community-Feed,
 * Gruppen, Gruppen-Chat, Direktnachrichten und öffentliche Profile.
 *
 * Hintergrund: Die Nutzungsbedingungen sagen seit dem 26.08.2026, dass Inhalte
 * privat bleiben und nicht veröffentlicht werden. Solange das gilt, darf in der
 * App nichts erreichbar sein, was Inhalte zwischen Nutzerinnen und Nutzern
 * austauscht — sonst fehlen genau die Passagen (Regeln, Melden, Blockieren,
 * 24-Stunden-Moderation), die Apple für solche Bereiche verlangt.
 *
 * Der Code der Bereiche bleibt liegen. Wird der Schalter wieder auf `true`
 * gesetzt, müssen die AGB-Passagen und die Consent-Texte zurück.
 */
export const COMMUNITY_ENABLED = false;

/** Ziel, auf das gesperrte Routen umgeleitet werden. */
export const COMMUNITY_FALLBACK_ROUTE = '/(tabs)/home';

/**
 * Pfad-Präfixe der gesperrten Bereiche. Bewusst als Liste und nicht als
 * einzelne Guards in den Screens: so greift die Sperre auch bei Deep Links,
 * Push-Benachrichtigungen und alten Verläufen, ohne dass eine Route vergessen
 * werden kann.
 */
const BLOCKED_PATH_PREFIXES = [
  '/community',
  '/groups',
  '/group-chat',
  '/chat',
  '/profile',
  '/blocked-users',
  // Der Benachrichtigungs-Screen speist sich ausschliesslich aus
  // community_notifications und direct_messages — ohne die Bereiche hat er
  // keine Quelle mehr.
  '/notifications',
];

/**
 * Greift die Sperre für diesen Pfad? Der Vergleich läuft über Segmentgrenzen,
 * damit `/chat` und `/chat/abc` treffen, ein künftiges `/chatbot` aber nicht.
 */
export const isBlockedCommunityPath = (pathname: string | null | undefined): boolean => {
  if (COMMUNITY_ENABLED) return false;
  if (!pathname) return false;

  // Gruppensegmente wie `(tabs)` tauchen in Pfaden von expo-router nicht auf,
  // ein führender Slash aber immer.
  const normalized = pathname.split('?')[0].replace(/\/+$/, '') || '/';

  return BLOCKED_PATH_PREFIXES.some(
    (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
  );
};
