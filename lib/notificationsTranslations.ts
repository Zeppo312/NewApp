/** Translation boundary for notifications, messages, and activity. */
export type NotificationsLocale = 'de' | 'en' | 'es';
export const DEFAULT_NOTIFICATIONS_LOCALE: NotificationsLocale = 'de';
const de = {
  'common.user': 'Benutzer', 'common.someone': 'Jemand', 'common.new': 'Neu',
  'date.now': 'Gerade eben', 'date.minutes': 'vor {{count}} Min', 'date.hours': 'vor {{count}} Std',
  'activity.likePost': 'hat deinen Beitrag geliked', 'activity.likeComment': 'hat deinen Kommentar geliked', 'activity.comment': 'hat auf deinen Beitrag geantwortet', 'activity.reply': 'hat auf deinen Kommentar geantwortet', 'activity.follow': 'folgt dir jetzt', 'activity.message': 'hat dir eine Nachricht gesendet',
  'tab.messages': 'Nachrichten', 'tab.activity': 'Aktivität', 'tab.comments': 'Kommentare',
  'empty.messagesTitle': 'Keine Nachrichten', 'empty.messagesSubtitle': 'Wenn dir jemand schreibt, erscheint es hier', 'empty.activityTitle': 'Keine Aktivitäten', 'empty.activitySubtitle': 'Wenn jemand deine Beiträge mag, erscheint es hier', 'empty.commentsTitle': 'Keine Kommentare', 'empty.commentsSubtitle': 'Wenn jemand auf deine Beiträge antwortet, erscheint es hier',
  'message.self': 'Du: {{preview}}', 'message.none': 'Noch keine Nachrichten',
  'search.emptyTitle': 'Keine Chats gefunden', 'search.emptySubtitle': 'Für deine Suche wurden keine Nachrichten, Gruppen oder Kontakte gefunden.', 'search.placeholder': 'Chats suchen',
  'screen.title': 'Benachrichtigungen', 'screen.subtitle': 'Nachrichten und Aktivitäten',
  'scheduled.sleepTitle': '💤 Schlaffenster beginnt bald', 'scheduled.sleepImmediate': 'Das vorhergesagte Schlaffenster startet in ca. {{minutes}} Minuten', 'scheduled.sleepBody': 'In 15 Minuten beginnt das vorhergesagte Schlaffenster ({{time}})',
  'scheduled.feedingTitle': '🍼 Bald Zeit zum Füttern', 'scheduled.feedingImmediate': 'Die nächste vorhergesagte Mahlzeit ist in ca. {{minutes}} Minuten', 'scheduled.feedingBody': 'In ca. 10 Minuten könnte dein Baby wieder Hunger haben (ca. {{time}})',
  'scheduled.sleepTrackingTitle': 'Schlafaufzeichnung läuft', 'scheduled.elapsed': 'Laufzeit: {{time}}', 'scheduled.sleepChannel': 'Schlaftracker',
  'scheduled.vitaminTitle': 'Vitamin D nicht vergessen', 'scheduled.vitaminBody': 'Denk an die Vitamin-D-Tablette und hake sie danach in Unser Tag ab.',
} as const;
export type NotificationsTranslationKey = keyof typeof de;
type Catalog = Record<NotificationsTranslationKey, string>;
const en: Catalog = {
  'common.user': 'User', 'common.someone': 'Someone', 'common.new': 'New', 'date.now': 'Just now', 'date.minutes': '{{count}} min ago', 'date.hours': '{{count}} hr ago',
  'activity.likePost': 'liked your post', 'activity.likeComment': 'liked your comment', 'activity.comment': 'replied to your post', 'activity.reply': 'replied to your comment', 'activity.follow': 'is now following you', 'activity.message': 'sent you a message',
  'tab.messages': 'Messages', 'tab.activity': 'Activity', 'tab.comments': 'Comments', 'empty.messagesTitle': 'No messages', 'empty.messagesSubtitle': 'Messages from others will appear here', 'empty.activityTitle': 'No activity', 'empty.activitySubtitle': 'Likes on your posts will appear here', 'empty.commentsTitle': 'No comments', 'empty.commentsSubtitle': 'Replies to your posts will appear here',
  'message.self': 'You: {{preview}}', 'message.none': 'No messages yet', 'search.emptyTitle': 'No chats found', 'search.emptySubtitle': 'No messages, groups, or contacts match your search.', 'search.placeholder': 'Search chats', 'screen.title': 'Notifications', 'screen.subtitle': 'Messages and activity',
  'scheduled.sleepTitle': '💤 Sleep window starts soon', 'scheduled.sleepImmediate': 'The predicted sleep window starts in about {{minutes}} minutes', 'scheduled.sleepBody': 'The predicted sleep window starts in 15 minutes ({{time}})', 'scheduled.feedingTitle': '🍼 Feeding time soon', 'scheduled.feedingImmediate': 'The next predicted feed is in about {{minutes}} minutes', 'scheduled.feedingBody': 'Your baby may be hungry again in about 10 minutes (around {{time}})', 'scheduled.sleepTrackingTitle': 'Sleep recording in progress', 'scheduled.elapsed': 'Elapsed: {{time}}', 'scheduled.sleepChannel': 'Sleep tracker', 'scheduled.vitaminTitle': "Don't forget vitamin D", 'scheduled.vitaminBody': 'Remember the vitamin D tablet, then check it off in Our Day.',
};
const es: Catalog = {
  'common.user': 'Usuario', 'common.someone': 'Alguien', 'common.new': 'Nuevo', 'date.now': 'Ahora mismo', 'date.minutes': 'hace {{count}} min', 'date.hours': 'hace {{count}} h',
  'activity.likePost': 'ha indicado que le gusta tu publicación', 'activity.likeComment': 'ha indicado que le gusta tu comentario', 'activity.comment': 'ha respondido a tu publicación', 'activity.reply': 'ha respondido a tu comentario', 'activity.follow': 'ahora te sigue', 'activity.message': 'te ha enviado un mensaje',
  'tab.messages': 'Mensajes', 'tab.activity': 'Actividad', 'tab.comments': 'Comentarios', 'empty.messagesTitle': 'No hay mensajes', 'empty.messagesSubtitle': 'Los mensajes que recibas aparecerán aquí', 'empty.activityTitle': 'No hay actividad', 'empty.activitySubtitle': 'Los «me gusta» de tus publicaciones aparecerán aquí', 'empty.commentsTitle': 'No hay comentarios', 'empty.commentsSubtitle': 'Las respuestas a tus publicaciones aparecerán aquí',
  'message.self': 'Tú: {{preview}}', 'message.none': 'Todavía no hay mensajes', 'search.emptyTitle': 'No se encontraron chats', 'search.emptySubtitle': 'No se encontraron mensajes, grupos ni contactos para tu búsqueda.', 'search.placeholder': 'Buscar chats', 'screen.title': 'Notificaciones', 'screen.subtitle': 'Mensajes y actividad',
  'scheduled.sleepTitle': '💤 La ventana de sueño empieza pronto', 'scheduled.sleepImmediate': 'La ventana de sueño prevista empieza en unos {{minutes}} minutos', 'scheduled.sleepBody': 'La ventana de sueño prevista empieza en 15 minutos ({{time}})', 'scheduled.feedingTitle': '🍼 Pronto será hora de comer', 'scheduled.feedingImmediate': 'La próxima toma prevista es en unos {{minutes}} minutos', 'scheduled.feedingBody': 'Tu bebé podría volver a tener hambre en unos 10 minutos (hacia las {{time}})', 'scheduled.sleepTrackingTitle': 'Registro de sueño en curso', 'scheduled.elapsed': 'Duración: {{time}}', 'scheduled.sleepChannel': 'Seguimiento del sueño', 'scheduled.vitaminTitle': 'No olvides la vitamina D', 'scheduled.vitaminBody': 'Recuerda la vitamina D y márcala después en Nuestro día.',
};
export const NOTIFICATIONS_TRANSLATIONS: Record<NotificationsLocale, Catalog> = { de, en, es };
export const getNotificationsLocaleTag = (locale: NotificationsLocale) => ({ de: 'de-DE', en: 'en-US', es: 'es-ES' })[locale];
export const translateNotificationsText = (locale: NotificationsLocale, key: NotificationsTranslationKey, params: Record<string, string | number> = {}) => {
  const template = NOTIFICATIONS_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params[token] ?? `{{${token}}}`));
};
