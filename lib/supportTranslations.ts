/**
 * Translation boundary for the support screen.
 *
 * German remains active until the app has a global language preference. The
 * screen can then switch locale without changing its UI or mail composition.
 */
export type SupportLocale = 'de' | 'en' | 'es';

export const DEFAULT_SUPPORT_LOCALE: SupportLocale = 'de';

const de = {
  'screen.title': 'Support',
  'screen.subtitle': 'Wir sind gerne für dich da',
  'hero.eyebrow': 'HILFE & FEEDBACK',
  'hero.title': 'Wie können wir helfen?',
  'hero.description': 'Ob Frage, Idee oder Problem – schreib uns einfach. Dein Feedback hilft uns, Lotti Baby noch besser zu machen.',
  'hero.reply': 'Persönliche Antwort',
  'hero.email': 'Direkt per E-Mail',
  'contact.title': 'Direkter Kontakt',
  'contact.emailTitle': 'E-Mail an den Support',
  'contact.emailDescription': 'Öffnet deine bevorzugte Mail-App',
  'contact.responseTime': 'Wir melden uns so schnell wie möglich bei dir zurück.',
  'form.title': 'Nachricht vorbereiten',
  'form.description': 'Erzähl uns kurz, wobei du Unterstützung brauchst.',
  'form.subjectLabel': 'Betreff',
  'form.subjectPlaceholder': 'Worum geht es?',
  'form.messageLabel': 'Deine Nachricht',
  'form.messagePlaceholder': 'Beschreibe deine Frage, deine Idee oder das Problem …',
  'form.send': 'E-Mail öffnen',
  'form.privacyNote': 'App-Version und – falls vorhanden – Konto-ID werden zur schnelleren Zuordnung automatisch ergänzt.',
  'mail.defaultSubject': 'Support-Anfrage',
  'mail.appVersion': 'App-Version',
  'mail.userId': 'User-ID',
  'alert.unavailableTitle': 'E-Mail nicht verfügbar',
  'alert.unavailableMessage': 'Bitte sende eine E-Mail an {{email}}.',
  'alert.errorTitle': 'Das hat leider nicht geklappt',
  'alert.errorMessage': 'Bitte sende deine Nachricht direkt an {{email}}.',
} as const;

export type SupportTranslationKey = keyof typeof de;
type Catalog = Record<SupportTranslationKey, string>;

const en: Catalog = {
  'screen.title': 'Support',
  'screen.subtitle': 'We’re happy to help',
  'hero.eyebrow': 'HELP & FEEDBACK',
  'hero.title': 'How can we help?',
  'hero.description': 'Whether you have a question, an idea, or a problem, just send us a message. Your feedback helps us make Lotti Baby even better.',
  'hero.reply': 'Personal reply',
  'hero.email': 'Directly by email',
  'contact.title': 'Contact us directly',
  'contact.emailTitle': 'Email support',
  'contact.emailDescription': 'Opens your preferred email app',
  'contact.responseTime': 'We’ll get back to you as soon as possible.',
  'form.title': 'Prepare your message',
  'form.description': 'Tell us briefly what you need help with.',
  'form.subjectLabel': 'Subject',
  'form.subjectPlaceholder': 'What is it about?',
  'form.messageLabel': 'Your message',
  'form.messagePlaceholder': 'Describe your question, idea, or problem …',
  'form.send': 'Open email app',
  'form.privacyNote': 'The app version and, if available, the account ID are added automatically to help us identify your request.',
  'mail.defaultSubject': 'Support request',
  'mail.appVersion': 'App version',
  'mail.userId': 'User ID',
  'alert.unavailableTitle': 'Email unavailable',
  'alert.unavailableMessage': 'Please email us at {{email}}.',
  'alert.errorTitle': 'That didn’t work',
  'alert.errorMessage': 'Please send your message directly to {{email}}.',
};

const es: Catalog = {
  'screen.title': 'Soporte',
  'screen.subtitle': 'Estamos aquí para ayudarte',
  'hero.eyebrow': 'AYUDA Y COMENTARIOS',
  'hero.title': '¿Cómo podemos ayudarte?',
  'hero.description': 'Si tienes una pregunta, una idea o un problema, escríbenos. Tus comentarios nos ayudan a mejorar Lotti Baby.',
  'hero.reply': 'Respuesta personal',
  'hero.email': 'Directamente por correo',
  'contact.title': 'Contacto directo',
  'contact.emailTitle': 'Enviar un correo a soporte',
  'contact.emailDescription': 'Abre tu aplicación de correo preferida',
  'contact.responseTime': 'Te responderemos lo antes posible.',
  'form.title': 'Prepara tu mensaje',
  'form.description': 'Cuéntanos brevemente en qué necesitas ayuda.',
  'form.subjectLabel': 'Asunto',
  'form.subjectPlaceholder': '¿De qué se trata?',
  'form.messageLabel': 'Tu mensaje',
  'form.messagePlaceholder': 'Describe tu pregunta, idea o problema …',
  'form.send': 'Abrir correo',
  'form.privacyNote': 'La versión de la app y, si está disponible, el ID de la cuenta se añaden automáticamente para identificar tu solicitud.',
  'mail.defaultSubject': 'Solicitud de soporte',
  'mail.appVersion': 'Versión de la app',
  'mail.userId': 'ID de usuario',
  'alert.unavailableTitle': 'Correo no disponible',
  'alert.unavailableMessage': 'Envíanos un correo a {{email}}.',
  'alert.errorTitle': 'No ha funcionado',
  'alert.errorMessage': 'Envía tu mensaje directamente a {{email}}.',
};

export const SUPPORT_TRANSLATIONS: Record<SupportLocale, Catalog> = { de, en, es };

export const translateSupportText = (
  locale: SupportLocale,
  key: SupportTranslationKey,
  params: Record<string, string | number> = {},
) => {
  const template = SUPPORT_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
    String(params[token] ?? `{{${token}}}`),
  );
};
