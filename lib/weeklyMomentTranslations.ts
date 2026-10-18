import { LOTTI_LEVELS, type LottiLevel } from './lottiPoints';

/** Translation boundary for Wochenmoment, its story, day sheet, and the 30-stage Lotti journey. */
export type WeeklyMomentLocale = 'de' | 'en' | 'es';
export const DEFAULT_WEEKLY_MOMENT_LOCALE: WeeklyMomentLocale = 'de';

const de = {
  'screen.title': 'Wochenmoment', 'story.ready': 'Eure Wochenkarte ist bereit', 'story.open': 'Eure Wochen-Story ansehen',
  'action.view': 'Ansehen ›', 'week.title': 'Eure Woche', 'week.activeDays': '{{count}} von 7 Tagen begleitet',
  'week.thisWeek': 'Diese Woche', 'points.hearts': 'Herzen', 'points.collect': '✨ {{count}} Herzen einsammeln',
  'points.collected': 'Eingesammelt 🤍 +{{count}} Herzen', 'area.feeding.one': 'Essensmoment', 'area.feeding.other': 'Essensmomente',
  'area.care.one': 'Pflegemoment', 'area.care.other': 'Pflegemomente', 'area.sleep.one': 'Schlafmoment', 'area.sleep.other': 'Schlafmomente',
  'sleep.total': 'Gesamtschlaf diese Woche', 'closing': 'Nicht jeder Tag muss perfekt dokumentiert sein. Jeder kleine Eintrag hilft euch, euren Alltag besser zu verstehen.',
  'day.accessibility': '{{day}} — Tagesdetails anzeigen', 'day.today': 'Heute', 'day.futureEmpty': 'Dieser Tag liegt noch vor euch 🤍',
  'day.todayEmpty': 'Heute ist noch nichts festgehalten — der erste Moment zählt doppelt schön.',
  'day.pastEmpty': 'An diesem Tag habt ihr nichts festgehalten — völlig okay. Nicht jeder Tag braucht Einträge.',
  'day.bonus': 'Bonus', 'day.allAreasBonus': ' — alle drei Bereiche an einem Tag!',
  'card.ready': 'Euer Wochen-Review ist bereit 🤍', 'card.title': 'Lottis Wochenmoment 🤍', 'card.details': 'Details',
  'card.collect': '✨ {{count}} einsammeln', 'card.waiting': 'Wochen-Review wartet', 'card.waitingDescription': 'Sobald ihr trackt, entsteht hier euer Rückblick.',
  'card.reviewAccessibility': 'Wochen-Review als Story ansehen', 'card.story': 'Story', 'card.maxLevel': 'Höchste Stufe erreicht 🤍',
  'card.untilLevel': 'Noch {{count}} Herzen bis „{{name}}“',
  'mood.quiet': 'Ruhig', 'mood.balanced': 'Im Gleichgewicht', 'mood.dreamy': 'Verträumt', 'mood.enjoyable': 'Genussvoll', 'mood.cozy': 'Kuschelig',
  'story.shareTitle': 'Unsere Lotti-Woche', 'story.shareMessage': 'Unsere Woche mit Lotti: {{moments}} Momente, +{{points}} Herzen 🤍',
  'story.shareFailedTitle': 'Teilen nicht möglich', 'story.shareFailed': 'Beim Teilen ist etwas schiefgegangen. Bitte versucht es später noch einmal.',
  'story.week': 'Eure Woche · {{range}}', 'story.emptyWeek': 'Eine stille Woche — auch die gehört zu eurer Geschichte.',
  'story.weekFeeling': 'So hat sich eure Woche angefühlt. Tippt weiter für euren Rückblick.', 'story.captured': 'Festgehalten',
  'story.moment.one': 'Moment diese Woche', 'story.moment.other': 'Momente diese Woche', 'story.feeding': 'Essen', 'story.care': 'Pflege', 'story.sleep': 'Schlaf',
  'story.record': 'Euer Rekord', 'story.strongestDay': 'war euer stärkster Tag — +{{points}} Herzen an einem Tag.',
  'story.totalSleep': 'Insgesamt hat Lotti {{duration}} geschlafen. 🌙', 'story.nextWeek': 'Nächste Woche',
  'story.firstRecord': 'wartet euer erster Rekord. Jeder kleine Moment zählt.', 'story.yourHearts': 'Eure Herzen',
  'story.heartsCollected': 'Herzen gesammelt', 'story.level': 'Stufe {{level}} · {{name}}', 'story.ourWeek': 'Unsere Lotti-Woche',
  'story.moments': 'Momente', 'story.days': 'Tage', 'story.hearts': 'Herzen', 'story.share': 'Wochenkarte teilen', 'story.done': 'Fertig',
  'story.tapNext': 'Tippen für weiter',
  'collection.title': 'Eure Lotti-Sammlung', 'collection.unlocked': '{{count}} von {{total}} Bildern freigeschaltet',
  'collection.expand': 'Lotti-Sammlung ausklappen', 'collection.collapse': 'Lotti-Sammlung einklappen', 'collection.all': 'Alle', 'collection.less': 'Weniger',
  'collection.unlockedState': 'Freigeschaltet', 'collection.hiddenState': 'Noch verborgen', 'collection.locked': 'Noch nicht freigeschaltet',
  'collection.newImage': 'Ein neues Lotti-Bild wartet', 'collection.unlockAt': 'Erreicht Stufe {{level}}, um dieses Bild zu enthüllen.',
  'collection.chosenHint': 'Dieses Bild ist euer Avatar auf der Wochenkarte und in der Lotti-Reise.',
  'collection.chooseHint': 'Als Avatar erscheint dieses Bild auf der Wochenkarte und in der Lotti-Reise.',
  'collection.chosen': 'Euer Avatar ✓', 'collection.choose': 'Als Avatar wählen',
  'journey.title': 'Eure Lotti-Reise', 'journey.subtitle': 'Jede Woche wachst ihr ein kleines Stück weiter.',
  'journey.current': 'Aktuell', 'journey.reached': 'Erreicht', 'journey.next': 'Als Nächstes', 'journey.stage': 'Stufe {{level}}',
  'journey.collected': '{{count}} Lotti-Herzen gesammelt', 'journey.untilNext': 'Noch {{count}} Lotti-Herzen bis „{{name}}“',
  'journey.progress': '{{percent}} % dieses Moments', 'journey.keepCollecting': 'Weiter sammeln',
  'journey.pastMessage': 'Diese Station gehört schon zu eurer Reise.', 'journey.currentMessage': 'Hier seid ihr gerade.',
  'journey.futureMessage': 'Mit jedem kleinen Moment kommt ihr ein Stück näher.', 'journey.threshold': 'ab {{count}} Lotti-Herzen', 'journey.close': 'Schließen',
  'toast.feeding': 'Essensmoment zur Woche hinzugefügt', 'toast.care': 'Pflegemoment zur Woche hinzugefügt', 'toast.sleep': 'Schlafmoment zur Woche hinzugefügt',
  'unit.minute': 'Min', 'unit.hour': 'Std',
} as const;
export type WeeklyMomentTranslationKey = keyof typeof de;
type Catalog = Record<WeeklyMomentTranslationKey, string>;

const en: Catalog = {
  'screen.title': 'Weekly moment', 'story.ready': 'Your weekly card is ready', 'story.open': 'View your weekly story', 'action.view': 'View ›',
  'week.title': 'Your week', 'week.activeDays': '{{count}} of 7 days accompanied', 'week.thisWeek': 'This week', 'points.hearts': 'Hearts',
  'points.collect': '✨ Collect {{count}} hearts', 'points.collected': 'Collected 🤍 +{{count}} hearts',
  'area.feeding.one': 'Feeding moment', 'area.feeding.other': 'Feeding moments', 'area.care.one': 'Care moment', 'area.care.other': 'Care moments',
  'area.sleep.one': 'Sleep moment', 'area.sleep.other': 'Sleep moments', 'sleep.total': 'Total sleep this week',
  'closing': 'Not every day needs to be documented perfectly. Every little entry helps you understand your daily life better.',
  'day.accessibility': '{{day}} — show day details', 'day.today': 'Today', 'day.futureEmpty': 'This day is still ahead of you 🤍',
  'day.todayEmpty': 'Nothing has been recorded today yet — the first moment will feel twice as special.',
  'day.pastEmpty': 'You did not record anything on this day — and that is completely okay. Not every day needs entries.',
  'day.bonus': 'Bonus', 'day.allAreasBonus': ' — all three areas in one day!', 'card.ready': 'Your weekly review is ready 🤍',
  'card.title': "Lotti's weekly moment 🤍", 'card.details': 'Details', 'card.collect': '✨ Collect {{count}}',
  'card.waiting': 'Weekly review is waiting', 'card.waitingDescription': 'Your review will appear here as soon as you start tracking.',
  'card.reviewAccessibility': 'View the weekly review as a story', 'card.story': 'Story', 'card.maxLevel': 'Highest stage reached 🤍',
  'card.untilLevel': '{{count}} hearts until “{{name}}”', 'mood.quiet': 'Calm', 'mood.balanced': 'In balance',
  'mood.dreamy': 'Dreamy', 'mood.enjoyable': 'Delightful', 'mood.cozy': 'Cozy',
  'story.shareTitle': 'Our Lotti week', 'story.shareMessage': 'Our week with Lotti: {{moments}} moments, +{{points}} hearts 🤍',
  'story.shareFailedTitle': 'Unable to share', 'story.shareFailed': 'Something went wrong while sharing. Please try again later.',
  'story.week': 'Your week · {{range}}', 'story.emptyWeek': 'A quiet week — that is part of your story too.',
  'story.weekFeeling': 'This is how your week felt. Keep tapping for your review.', 'story.captured': 'Captured',
  'story.moment.one': 'Moment this week', 'story.moment.other': 'Moments this week', 'story.feeding': 'Feeding', 'story.care': 'Care', 'story.sleep': 'Sleep',
  'story.record': 'Your record', 'story.strongestDay': 'was your strongest day — +{{points}} hearts in one day.',
  'story.totalSleep': 'Lotti slept for a total of {{duration}}. 🌙', 'story.nextWeek': 'Next week',
  'story.firstRecord': 'your first record is waiting. Every little moment counts.', 'story.yourHearts': 'Your hearts',
  'story.heartsCollected': 'Hearts collected', 'story.level': 'Stage {{level}} · {{name}}', 'story.ourWeek': 'Our Lotti week',
  'story.moments': 'Moments', 'story.days': 'Days', 'story.hearts': 'Hearts', 'story.share': 'Share weekly card', 'story.done': 'Done',
  'story.tapNext': 'Tap to continue', 'collection.title': 'Your Lotti collection', 'collection.unlocked': '{{count}} of {{total}} images unlocked',
  'collection.expand': 'Expand Lotti collection', 'collection.collapse': 'Collapse Lotti collection', 'collection.all': 'All', 'collection.less': 'Less',
  'collection.unlockedState': 'Unlocked', 'collection.hiddenState': 'Still hidden', 'collection.locked': 'Not unlocked yet',
  'collection.newImage': 'A new Lotti image is waiting', 'collection.unlockAt': 'Reach stage {{level}} to reveal this image.',
  'collection.chosenHint': 'This image is your avatar on the weekly card and the Lotti journey.',
  'collection.chooseHint': 'Choosing it makes this image your avatar on the weekly card and the Lotti journey.',
  'collection.chosen': 'Your avatar ✓', 'collection.choose': 'Choose as avatar',
  'journey.title': 'Your Lotti journey', 'journey.subtitle': 'Every week, you grow a little further together.',
  'journey.current': 'Current', 'journey.reached': 'Reached', 'journey.next': 'Up next', 'journey.stage': 'Stage {{level}}',
  'journey.collected': '{{count}} Lotti hearts collected', 'journey.untilNext': '{{count}} Lotti hearts until “{{name}}”',
  'journey.progress': '{{percent}}% of this moment', 'journey.keepCollecting': 'Keep collecting',
  'journey.pastMessage': 'This stop is already part of your journey.', 'journey.currentMessage': 'This is where you are now.',
  'journey.futureMessage': 'Every little moment brings you one step closer.', 'journey.threshold': 'from {{count}} Lotti hearts', 'journey.close': 'Close',
  'toast.feeding': 'Feeding moment added to this week', 'toast.care': 'Care moment added to this week', 'toast.sleep': 'Sleep moment added to this week',
  'unit.minute': 'min', 'unit.hour': 'hr',
};

const es: Catalog = {
  'screen.title': 'Momento semanal', 'story.ready': 'Vuestra tarjeta semanal está lista', 'story.open': 'Ver vuestra historia semanal', 'action.view': 'Ver ›',
  'week.title': 'Vuestra semana', 'week.activeDays': '{{count}} de 7 días acompañados', 'week.thisWeek': 'Esta semana', 'points.hearts': 'Corazones',
  'points.collect': '✨ Recoger {{count}} corazones', 'points.collected': 'Recogidos 🤍 +{{count}} corazones',
  'area.feeding.one': 'Momento de alimentación', 'area.feeding.other': 'Momentos de alimentación',
  'area.care.one': 'Momento de cuidados', 'area.care.other': 'Momentos de cuidados', 'area.sleep.one': 'Momento de sueño',
  'area.sleep.other': 'Momentos de sueño', 'sleep.total': 'Sueño total de esta semana',
  'closing': 'No hace falta documentar cada día a la perfección. Cada pequeña entrada os ayuda a comprender mejor vuestro día a día.',
  'day.accessibility': '{{day}} — mostrar detalles del día', 'day.today': 'Hoy', 'day.futureEmpty': 'Este día todavía está por llegar 🤍',
  'day.todayEmpty': 'Todavía no habéis registrado nada hoy; el primer momento será doblemente bonito.',
  'day.pastEmpty': 'Ese día no registrasteis nada, y no pasa nada. No todos los días necesitan entradas.',
  'day.bonus': 'Bonus', 'day.allAreasBonus': ' — ¡las tres áreas en un solo día!', 'card.ready': 'Vuestro resumen semanal está listo 🤍',
  'card.title': 'El momento semanal de Lotti 🤍', 'card.details': 'Detalles', 'card.collect': '✨ Recoger {{count}}',
  'card.waiting': 'El resumen semanal os espera', 'card.waitingDescription': 'En cuanto empecéis a registrar, vuestro resumen aparecerá aquí.',
  'card.reviewAccessibility': 'Ver el resumen semanal como una historia', 'card.story': 'Historia', 'card.maxLevel': 'Etapa más alta alcanzada 🤍',
  'card.untilLevel': 'Faltan {{count}} corazones para «{{name}}»', 'mood.quiet': 'Tranquila', 'mood.balanced': 'En equilibrio',
  'mood.dreamy': 'Soñadora', 'mood.enjoyable': 'Deliciosa', 'mood.cozy': 'Acogedora',
  'story.shareTitle': 'Nuestra semana con Lotti', 'story.shareMessage': 'Nuestra semana con Lotti: {{moments}} momentos, +{{points}} corazones 🤍',
  'story.shareFailedTitle': 'No se puede compartir', 'story.shareFailed': 'Algo ha fallado al compartir. Volved a intentarlo más tarde.',
  'story.week': 'Vuestra semana · {{range}}', 'story.emptyWeek': 'Una semana tranquila; también forma parte de vuestra historia.',
  'story.weekFeeling': 'Así se ha sentido vuestra semana. Seguid tocando para ver el resumen.', 'story.captured': 'Registrado',
  'story.moment.one': 'Momento de esta semana', 'story.moment.other': 'Momentos de esta semana', 'story.feeding': 'Alimentación', 'story.care': 'Cuidados', 'story.sleep': 'Sueño',
  'story.record': 'Vuestro récord', 'story.strongestDay': 'fue vuestro día más fuerte: +{{points}} corazones en un día.',
  'story.totalSleep': 'Lotti durmió un total de {{duration}}. 🌙', 'story.nextWeek': 'La próxima semana',
  'story.firstRecord': 'os espera vuestro primer récord. Cada pequeño momento cuenta.', 'story.yourHearts': 'Vuestros corazones',
  'story.heartsCollected': 'Corazones recogidos', 'story.level': 'Etapa {{level}} · {{name}}', 'story.ourWeek': 'Nuestra semana con Lotti',
  'story.moments': 'Momentos', 'story.days': 'Días', 'story.hearts': 'Corazones', 'story.share': 'Compartir tarjeta semanal', 'story.done': 'Listo',
  'story.tapNext': 'Toca para continuar', 'collection.title': 'Vuestra colección de Lotti', 'collection.unlocked': '{{count}} de {{total}} imágenes desbloqueadas',
  'collection.expand': 'Desplegar la colección de Lotti', 'collection.collapse': 'Plegar la colección de Lotti', 'collection.all': 'Todas', 'collection.less': 'Menos',
  'collection.unlockedState': 'Desbloqueada', 'collection.hiddenState': 'Todavía oculta', 'collection.locked': 'Aún no desbloqueada',
  'collection.newImage': 'Os espera una nueva imagen de Lotti', 'collection.unlockAt': 'Alcanzad la etapa {{level}} para descubrir esta imagen.',
  'collection.chosenHint': 'Esta imagen es vuestro avatar en la tarjeta semanal y en el viaje de Lotti.',
  'collection.chooseHint': 'Al elegirla, esta imagen aparecerá como avatar en la tarjeta semanal y en el viaje de Lotti.',
  'collection.chosen': 'Vuestro avatar ✓', 'collection.choose': 'Elegir como avatar',
  'journey.title': 'Vuestro viaje con Lotti', 'journey.subtitle': 'Cada semana crecéis juntos un poquito más.',
  'journey.current': 'Actual', 'journey.reached': 'Alcanzada', 'journey.next': 'A continuación', 'journey.stage': 'Etapa {{level}}',
  'journey.collected': '{{count}} corazones de Lotti recogidos', 'journey.untilNext': 'Faltan {{count}} corazones de Lotti para «{{name}}»',
  'journey.progress': '{{percent}} % de este momento', 'journey.keepCollecting': 'Seguir recogiendo',
  'journey.pastMessage': 'Esta parada ya forma parte de vuestro viaje.', 'journey.currentMessage': 'Aquí estáis ahora.',
  'journey.futureMessage': 'Cada pequeño momento os acerca un poco más.', 'journey.threshold': 'desde {{count}} corazones de Lotti', 'journey.close': 'Cerrar',
  'toast.feeding': 'Momento de alimentación añadido a esta semana', 'toast.care': 'Momento de cuidados añadido a esta semana', 'toast.sleep': 'Momento de sueño añadido a esta semana',
  'unit.minute': 'min', 'unit.hour': 'h',
};

export const WEEKLY_MOMENT_TRANSLATIONS: Record<WeeklyMomentLocale, Catalog> = { de, en, es };
export const translateWeeklyMomentText = (locale: WeeklyMomentLocale, key: WeeklyMomentTranslationKey, params: Record<string, string | number> = {}) =>
  (WEEKLY_MOMENT_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params[token] ?? `{{${token}}}`));

export const WEEKLY_MOMENT_DAY_NAMES: Record<WeeklyMomentLocale, readonly string[]> = {
  de: ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'],
  en: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
  es: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'],
};
export const WEEKLY_MOMENT_DAY_SHORT_NAMES: Record<WeeklyMomentLocale, readonly string[]> = {
  de: ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'], en: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
  es: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
};

export const formatWeeklyMomentDuration = (locale: WeeklyMomentLocale, minutes: number) => {
  if (minutes <= 0) return null;
  const hours = Math.floor(minutes / 60);
  const remainder = Math.round(minutes % 60);
  const hourUnit = translateWeeklyMomentText(locale, 'unit.hour');
  const minuteUnit = translateWeeklyMomentText(locale, 'unit.minute');
  if (hours <= 0) return `${remainder} ${minuteUnit}`;
  if (remainder === 0) return `${hours} ${hourUnit}`;
  return `${hours} ${hourUnit} ${remainder} ${minuteUnit}`;
};

export const formatWeeklyMomentRange = (locale: WeeklyMomentLocale, start: Date, end: Date) => {
  const localeTag = { de: 'de-DE', en: 'en-US', es: 'es-ES' }[locale];
  const sameMonth = start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear();
  if (sameMonth) return `${start.getDate()}–${end.toLocaleDateString(localeTag, { day: 'numeric', month: 'long' })}`;
  return `${start.toLocaleDateString(localeTag, { day: 'numeric', month: 'long' })} – ${end.toLocaleDateString(localeTag, { day: 'numeric', month: 'long' })}`;
};

const enLevels: readonly (readonly [string, string])[] = [
  ['First steps', 'You are getting to know each other — one step at a time.'], ['Routines emerge', 'Small habits that carry you.'],
  ['Your week grows', 'Your days slowly begin to take shape.'], ['Patterns become visible', 'You recognize what Lotti needs right now.'],
  ['Lotti accompanies you', 'Lotti is woven into your daily life.'], ['Memories grow', 'Collecting special moments together.'],
  ['Weekly pro', 'You navigate your weeks with calm.'], ['Familiar paths', 'Your paths become safer and easier.'],
  ['Shared routines', 'You support one another.'], ['Little rituals', 'Your loving moments become traditions.'],
  ['Gentle habits', 'What feels good for you remains.'], ['Family rhythm', 'Your daily life finds its own small, wonderful rhythm.'],
  ['Lotti family', 'Your network strengthens and supports you.'], ['Shared moments', 'Your little moments connect you deeply.'],
  ['Your story', 'Your weeks become your story.'], ['Memory collectors', 'You have already created a treasure.'],
  ['Weekly chroniclers', 'You have developed a feel for your time.'], ['Your journey grows', 'Your path becomes clearer.'],
  ['Gentle observers', 'You notice the subtle changes.'], ['Mindful parents', 'Your attention gives Lotti security.'],
  ['Your connection', 'Your bond grows deeper.'], ['Lotti companions', 'You are Lotti’s safe home.'],
  ['Your treasure chest', 'Memories you will keep forever.'], ['Your world emerges', 'You are shaping Lotti’s very first world.'],
  ['Day by day', 'Your consistency is a gift.'], ['Your quiet strength', 'You are stronger than you know.'],
  ['Familiar warmth', 'Your home has a sound of its own.'], ['Your chapters', 'A new chapter every week.'],
  ['Family chronicle', 'Your family has a story.'], ['Your world of memories', 'A world that belongs only to you.'],
];

const esLevels: readonly (readonly [string, string])[] = [
  ['Primeros pasos', 'Os estáis conociendo, paso a paso.'], ['Nacen las rutinas', 'Pequeños hábitos que os sostienen.'],
  ['Vuestra semana crece', 'Vuestros días empiezan a tomar forma poco a poco.'], ['Los patrones se hacen visibles', 'Reconocéis lo que Lotti necesita en cada momento.'],
  ['Lotti os acompaña', 'Lotti forma parte de vuestro día a día.'], ['Crecen los recuerdos', 'Juntos coleccionáis momentos especiales.'],
  ['Expertos semanales', 'Vivís vuestras semanas con calma.'], ['Caminos familiares', 'Vuestros caminos se vuelven más seguros y fáciles.'],
  ['Rutinas compartidas', 'Os apoyáis mutuamente.'], ['Pequeños rituales', 'Vuestros momentos de cariño se convierten en tradición.'],
  ['Hábitos amables', 'Lo que os hace bien permanece.'], ['Ritmo familiar', 'Vuestro día a día encuentra su propio gran ritmo.'],
  ['Familia Lotti', 'Vuestra red os fortalece y os sostiene.'], ['Instantes compartidos', 'Vuestros pequeños momentos os unen profundamente.'],
  ['Vuestra historia', 'Vuestras semanas se convierten en vuestra historia.'], ['Coleccionistas de recuerdos', 'Ya habéis creado un tesoro.'],
  ['Cronistas semanales', 'Habéis desarrollado una sensibilidad especial para vuestro tiempo.'], ['Vuestro viaje crece', 'Vuestro camino se vuelve más claro.'],
  ['Observadores atentos', 'Percibís los cambios más sutiles.'], ['Familia consciente', 'Vuestra atención le da seguridad a Lotti.'],
  ['Vuestra conexión', 'Vuestro vínculo se hace más profundo.'], ['Compañeros de Lotti', 'Sois el hogar seguro de Lotti.'],
  ['Vuestro cofre del tesoro', 'Recuerdos que conservaréis para siempre.'], ['Nace vuestro mundo', 'Estáis dando forma al primer mundo de Lotti.'],
  ['Día tras día', 'Vuestra constancia es un regalo.'], ['Vuestra fuerza serena', 'Sois más fuertes de lo que creéis.'],
  ['Calidez familiar', 'Vuestro hogar tiene un sonido propio.'], ['Vuestros capítulos', 'Cada semana, un capítulo nuevo.'],
  ['Crónica familiar', 'Vuestra familia tiene una historia.'], ['Vuestro mundo de recuerdos', 'Un mundo que solo os pertenece a vosotros.'],
];

export const getLocalizedLottiLevels = (locale: WeeklyMomentLocale): readonly LottiLevel[] => {
  if (locale === 'de') return LOTTI_LEVELS;
  const translations = locale === 'en' ? enLevels : esLevels;
  return LOTTI_LEVELS.map((level, index) => ({ ...level, name: translations[index][0], description: translations[index][1] }));
};

export const getWeeklyMomentMood = (locale: WeeklyMomentLocale, counts: { feeding: number; care: number; sleep: number }) => {
  const total = counts.feeding + counts.care + counts.sleep;
  if (total === 0) return { word: translateWeeklyMomentText(locale, 'mood.quiet'), emoji: '🕊️' };
  const max = Math.max(counts.feeding, counts.care, counts.sleep);
  if (max / total < 0.45 && counts.feeding > 0 && counts.care > 0 && counts.sleep > 0) return { word: translateWeeklyMomentText(locale, 'mood.balanced'), emoji: '✨' };
  if (max === counts.sleep) return { word: translateWeeklyMomentText(locale, 'mood.dreamy'), emoji: '🌙' };
  if (max === counts.feeding) return { word: translateWeeklyMomentText(locale, 'mood.enjoyable'), emoji: '🍼' };
  return { word: translateWeeklyMomentText(locale, 'mood.cozy'), emoji: '🤍' };
};
