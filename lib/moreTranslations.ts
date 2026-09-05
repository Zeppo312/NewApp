/** Translation boundary for the More menu. */
export type MoreLocale = 'de' | 'en' | 'es';

export const DEFAULT_MORE_LOCALE: MoreLocale = 'de';

const de = {
  'common.error': 'Fehler',
  'common.cancel': 'Abbrechen',
  'common.unknownError': 'Unbekannter Fehler',
  'screen.title': 'Mehr',
  'screen.subtitle': 'Einstellungen und weitere Funktionen',
  'subscription.section': 'Abo',
  'subscription.manage': 'Abo verwalten',
  'subscription.access': 'Zugang ansehen',
  'subscription.view': 'Abo ansehen',
  'subscription.manageDescription': 'Sieh nach, welches Abo aktiv ist, und verwalte deinen Zugang',
  'subscription.activeDescription': '{{reason}}-Zugang aktiv',
  'subscription.viewDescription': 'Sieh deinen Status an oder wähle ein Abo aus',
  'shop.section': 'Shop',
  'shop.title': 'Lotti Baby Shop',
  'shop.description': 'Prints ansehen und bestellen',
  'settings.section': 'Einstellungen',
  'settings.appTitle': 'App-Einstellungen',
  'settings.appDescription': 'Benachrichtigungen, Erscheinungsbild usw.',
  'settings.profileTitle': 'Profil',
  'settings.profileDescription': 'Deine persönlichen Daten verwalten',
  'settings.linkTitle': 'Accounts verknüpfen',
  'settings.linkDescription': 'Verbinde dich mit deinem Partner oder deiner Familie',
  'support.section': 'Support',
  'support.contact': 'Support kontaktieren',
  'support.suggestions': 'Verbesserungsvorschläge',
  'support.suggestionsDescription': 'Teile deine Ideen zur Verbesserung der App',
  'legal.section': 'Rechtliches',
  'legal.privacy': 'Datenschutz',
  'legal.privacyVersion': 'Stand: 03.02.2026',
  'legal.terms': 'Nutzungsbedingungen',
  'legal.termsVersion': 'Stand: 07.03.2026',
  'legal.imprint': 'Impressum',
  'logout.action': 'Abmelden',
  'logout.question': 'Möchtest du dich wirklich abmelden?',
  'logout.failed': 'Beim Abmelden ist ein Fehler aufgetreten.\n{{message}}',
} as const;

export type MoreTranslationKey = keyof typeof de;
type Catalog = Record<MoreTranslationKey, string>;

const en: Catalog = {
  'common.error': 'Error', 'common.cancel': 'Cancel', 'common.unknownError': 'Unknown error',
  'screen.title': 'More', 'screen.subtitle': 'Settings and more features',
  'subscription.section': 'Subscription', 'subscription.manage': 'Manage subscription', 'subscription.access': 'View access', 'subscription.view': 'View subscription',
  'subscription.manageDescription': 'See which subscription is active and manage your access', 'subscription.activeDescription': '{{reason}} access active', 'subscription.viewDescription': 'Check your status or choose a subscription',
  'shop.section': 'Shop', 'shop.title': 'Lotti Baby Shop', 'shop.description': 'Browse and order prints',
  'settings.section': 'Settings', 'settings.appTitle': 'App settings', 'settings.appDescription': 'Notifications, appearance, and more', 'settings.profileTitle': 'Profile', 'settings.profileDescription': 'Manage your personal information', 'settings.linkTitle': 'Link accounts', 'settings.linkDescription': 'Connect with your partner or family',
  'support.section': 'Support', 'support.contact': 'Contact support', 'support.suggestions': 'Feature suggestions', 'support.suggestionsDescription': 'Share your ideas for improving the app',
  'legal.section': 'Legal', 'legal.privacy': 'Privacy policy', 'legal.privacyVersion': 'Updated: February 3, 2026', 'legal.terms': 'Terms of use', 'legal.termsVersion': 'Updated: March 7, 2026', 'legal.imprint': 'Legal notice',
  'logout.action': 'Sign out', 'logout.question': 'Do you really want to sign out?', 'logout.failed': 'There was a problem signing out.\n{{message}}',
};

const es: Catalog = {
  'common.error': 'Error', 'common.cancel': 'Cancelar', 'common.unknownError': 'Error desconocido',
  'screen.title': 'Más', 'screen.subtitle': 'Ajustes y más funciones',
  'subscription.section': 'Suscripción', 'subscription.manage': 'Gestionar suscripción', 'subscription.access': 'Ver acceso', 'subscription.view': 'Ver suscripción',
  'subscription.manageDescription': 'Consulta qué suscripción está activa y gestiona tu acceso', 'subscription.activeDescription': 'Acceso {{reason}} activo', 'subscription.viewDescription': 'Consulta tu estado o elige una suscripción',
  'shop.section': 'Tienda', 'shop.title': 'Tienda Lotti Baby', 'shop.description': 'Ver y pedir estampados',
  'settings.section': 'Ajustes', 'settings.appTitle': 'Ajustes de la app', 'settings.appDescription': 'Notificaciones, aspecto y mucho más', 'settings.profileTitle': 'Perfil', 'settings.profileDescription': 'Gestiona tus datos personales', 'settings.linkTitle': 'Vincular cuentas', 'settings.linkDescription': 'Conecta con tu pareja o tu familia',
  'support.section': 'Ayuda', 'support.contact': 'Contactar con soporte', 'support.suggestions': 'Sugerencias de mejora', 'support.suggestionsDescription': 'Comparte tus ideas para mejorar la app',
  'legal.section': 'Información legal', 'legal.privacy': 'Política de privacidad', 'legal.privacyVersion': 'Actualizado: 03/02/2026', 'legal.terms': 'Condiciones de uso', 'legal.termsVersion': 'Actualizado: 07/03/2026', 'legal.imprint': 'Aviso legal',
  'logout.action': 'Cerrar sesión', 'logout.question': '¿Seguro que quieres cerrar sesión?', 'logout.failed': 'Se ha producido un error al cerrar sesión.\n{{message}}',
};

export const MORE_TRANSLATIONS: Record<MoreLocale, Catalog> = { de, en, es };

export const translateMoreText = (
  locale: MoreLocale,
  key: MoreTranslationKey,
  params: Record<string, string | number> = {},
) => {
  const template = MORE_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
    String(params[token] ?? `{{${token}}}`),
  );
};
