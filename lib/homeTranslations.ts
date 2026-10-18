/** Translation boundary for the post-birth home screen. */
export type HomeLocale = 'de' | 'en' | 'es';
export const DEFAULT_HOME_LOCALE: HomeLocale = 'de';

const de = {
  'common.error': 'Fehler', 'common.notice': 'Hinweis',
  'card.recipes.title': 'BLW-Rezepte', 'card.recipes.description': 'Rezepte entdecken',
  'card.shopping.title': 'Einkauf', 'card.shopping.description': 'Einkaufsliste & Karten',
  'card.baby.title': 'Mein Baby', 'card.baby.description': 'Alle Infos & Entwicklungen',
  'card.planner.title': 'Planer', 'card.planner.description': 'Tagesplan & To-dos',
  'card.daily.title': 'Unser Tag', 'card.daily.description': 'Tagesaktivitäten verwalten',
  'card.selfcare.title': 'Mama Selfcare', 'card.selfcare.description': 'Nimm dir Zeit für dich',
  'card.weather.title': 'Babywetter', 'card.weather.description': 'Aktuelle Wetterinfos',
  'card.shop.title': 'Lotti Baby Shop', 'card.shop.description': 'Prints shoppen',
  'card.weight.title': 'Gewichtskurve', 'card.weight.description': 'Gewicht tracken',
  'card.size.title': 'Größenkurve', 'card.size.description': 'Babygröße tracken',
  'card.teeth.title': 'Zahn-Tracker', 'card.teeth.description': 'Erste Zähnchen',
  'card.milestones.title': 'Meilensteine', 'card.milestones.description': 'Erste Male festhalten',
  'timer.sleep.label': 'Schlaftracker', 'timer.sleep.title': 'Schlummerzeit', 'timer.sleep.titleNamed': '{{name}} schlummert', 'timer.sleep.subtitle': 'Pssst, es wird geträumt', 'timer.sleep.progress': 'heute {{done}} von ca. {{target}}', 'timer.sleep.hint': 'Tippe, um direkt in den Schlaftracker zu springen',
  'timer.breast': 'Stillen läuft', 'timer.bottle': 'Fläschchen läuft', 'timer.solids': 'Beikost läuft', 'timer.pump': 'Abpumpen läuft', 'timer.water': 'Wasser läuft',
  'timer.daily.label': 'Unser Tag', 'timer.daily.hint': 'Tippe, um direkt in „Unser Tag“ weiterzumachen', 'timer.since': 'seit {{time}}',
  'alert.keepTile': 'Mindestens eine Schnellzugriff-Kachel muss sichtbar bleiben.',
  'alert.unknownEntry': 'Unbekannter Eintragstyp. Bitte erneut versuchen.', 'alert.entrySaveFailed': 'Eintrag konnte nicht gespeichert werden.',
  'alert.signInForSleep': 'Bitte melde dich an, um Schlaf zu speichern.', 'alert.sleepSaveFailed': 'Schlaf konnte nicht gespeichert werden.', 'alert.sleepEntrySaveFailed': 'Schlafeintrag konnte nicht gespeichert werden.',
  'greeting.fallbackName': 'Mama', 'greeting.hello': 'Hallo {{name}}!',
  'summary.title': 'Dein Tag im Überblick', 'summary.noMeal': 'Keine Mahlzeit heute',
  'summary.bottle': 'Flasche {{count}}×', 'summary.breast': 'Stillen {{count}}×', 'summary.solids': 'Beikost {{count}}×', 'summary.pump': 'Abpumpen {{count}}×', 'summary.water': 'Wasser {{count}}×',
  'summary.breastOnly': 'Stillen', 'summary.solidsOnly': 'Beikost', 'summary.diapers': 'Windeln', 'summary.sleep': 'Schlaf',
  'shop.button': 'Shop', 'shop.accessibility': 'Lotti Baby Shop öffnen', 'shop.eyebrow': 'Lotti Baby Shop', 'shop.title': 'Prints zum Aufbügeln', 'shop.description': 'Lieblingsmotiv wählen und direkt bestellen', 'shop.empty': 'Prints ansehen und bestellen.',
  'premium.advisor': 'Lottis Fürsorge', 'premium.advisorDescription': 'Persönliche Hinweise aus Schlaf, Wetter & Ernährung', 'premium.voice': 'Per Sprache eintragen', 'premium.voiceDescription': 'Schlaf, Füttern, Windeln, Einkaufsliste & Planer einsprechen', 'premium.askLotti': 'Frag Lotti', 'premium.askLottiDescription': 'Alltagstipps – mit euren Daten, wenn passend',
  'quick.hideAccessibility': '{{title}} ausblenden', 'quick.hiddenTitle': 'Ausgeblendet', 'quick.hidden.one': '1 Kachel ist ausgeblendet.', 'quick.hidden.other': '{{count}} Kacheln sind ausgeblendet.',
  'quick.restoreAll': 'Alle einblenden', 'quick.restoreHint': 'Tippe auf eine ausgeblendete Kachel, um sie wieder anzuzeigen.', 'quick.restore': 'Einblenden',
  'quick.title': 'Schnellzugriff', 'quick.done': 'Fertig', 'quick.editHint': 'Kacheln verschieben, ausblenden und mit „Fertig“ speichern.', 'quick.longPressHint': 'Lange auf eine Kachel drücken, um die Reihenfolge anzupassen.', 'quick.hiddenHint': 'Ausgeblendete Kacheln kannst du unten wieder einblenden.',
  'loading.title': 'Lade deine persönliche Übersicht …', 'loading.refresh': 'Aktualisiere …',
} as const;
export type HomeTranslationKey = keyof typeof de;
type Catalog = Record<HomeTranslationKey, string>;

const en: Catalog = {
  'common.error': 'Error', 'common.notice': 'Note',
  'card.recipes.title': 'BLW recipes', 'card.recipes.description': 'Discover recipes', 'card.shopping.title': 'Shopping', 'card.shopping.description': 'Shopping list & cards', 'card.baby.title': 'My baby', 'card.baby.description': 'All information & development', 'card.planner.title': 'Planner', 'card.planner.description': 'Daily plan & to-dos', 'card.daily.title': 'Our day', 'card.daily.description': 'Manage daily activities', 'card.selfcare.title': 'Mom self-care', 'card.selfcare.description': 'Take some time for yourself', 'card.weather.title': 'Baby weather', 'card.weather.description': 'Current weather information', 'card.shop.title': 'Lotti Baby Shop', 'card.shop.description': 'Shop iron-on prints', 'card.weight.title': 'Weight chart', 'card.weight.description': 'Track weight', 'card.size.title': 'Growth chart', 'card.size.description': 'Track baby’s height', 'card.teeth.title': 'Tooth tracker', 'card.teeth.description': 'First little teeth', 'card.milestones.title': 'Milestones', 'card.milestones.description': 'Capture first moments',
  'timer.sleep.label': 'Sleep tracker', 'timer.sleep.title': 'Nap time', 'timer.sleep.titleNamed': '{{name}} is snoozing', 'timer.sleep.subtitle': 'Shhh, sweet dreams', 'timer.sleep.progress': 'today {{done}} of about {{target}}', 'timer.sleep.hint': 'Tap to jump straight to the sleep tracker', 'timer.breast': 'Breastfeeding in progress', 'timer.bottle': 'Bottle feeding in progress', 'timer.solids': 'Solid feeding in progress', 'timer.pump': 'Pumping in progress', 'timer.water': 'Water intake in progress', 'timer.daily.label': 'Our day', 'timer.daily.hint': 'Tap to continue in “Our day”', 'timer.since': 'since {{time}}',
  'alert.keepTile': 'At least one quick-access tile must remain visible.', 'alert.unknownEntry': 'Unknown entry type. Please try again.', 'alert.entrySaveFailed': 'The entry could not be saved.', 'alert.signInForSleep': 'Please sign in to save sleep.', 'alert.sleepSaveFailed': 'Sleep could not be saved.', 'alert.sleepEntrySaveFailed': 'The sleep entry could not be saved.',
  'greeting.fallbackName': 'Mom', 'greeting.hello': 'Hello {{name}}!', 'summary.title': 'Your day at a glance', 'summary.noMeal': 'No feeding today', 'summary.bottle': 'Bottle {{count}}×', 'summary.breast': 'Breastfeeding {{count}}×', 'summary.solids': 'Solids {{count}}×', 'summary.pump': 'Pumping {{count}}×', 'summary.water': 'Water {{count}}×', 'summary.breastOnly': 'Breastfeeding', 'summary.solidsOnly': 'Solids', 'summary.diapers': 'Diapers', 'summary.sleep': 'Sleep',
  'shop.button': 'Shop', 'shop.accessibility': 'Open Lotti Baby Shop', 'shop.eyebrow': 'Lotti Baby Shop', 'shop.title': 'Iron-on prints', 'shop.description': 'Choose your favorite design and order it directly', 'shop.empty': 'Browse and order prints.',
  'premium.advisor': 'Lotti’s care', 'premium.advisorDescription': 'Personal insights from sleep, weather & nutrition', 'premium.voice': 'Log by voice', 'premium.voiceDescription': 'Record sleep, feeding, diapers, shopping list & planner by voice', 'premium.askLotti': 'Ask Lotti', 'premium.askLottiDescription': 'Everyday guidance, personalized when relevant',
  'quick.hideAccessibility': 'Hide {{title}}', 'quick.hiddenTitle': 'Hidden', 'quick.hidden.one': '1 tile is hidden.', 'quick.hidden.other': '{{count}} tiles are hidden.', 'quick.restoreAll': 'Show all', 'quick.restoreHint': 'Tap a hidden tile to show it again.', 'quick.restore': 'Show', 'quick.title': 'Quick access', 'quick.done': 'Done', 'quick.editHint': 'Move or hide tiles and tap “Done” to save.', 'quick.longPressHint': 'Press and hold a tile to change the order.', 'quick.hiddenHint': 'You can show hidden tiles again below.', 'loading.title': 'Loading your personal overview …', 'loading.refresh': 'Refreshing …',
};

const es: Catalog = {
  'common.error': 'Error', 'common.notice': 'Aviso',
  'card.recipes.title': 'Recetas BLW', 'card.recipes.description': 'Descubrir recetas', 'card.shopping.title': 'Compras', 'card.shopping.description': 'Lista de compras y tarjetas', 'card.baby.title': 'Mi bebé', 'card.baby.description': 'Información y desarrollo', 'card.planner.title': 'Planificador', 'card.planner.description': 'Plan diario y tareas', 'card.daily.title': 'Nuestro día', 'card.daily.description': 'Gestionar actividades diarias', 'card.selfcare.title': 'Autocuidado de mamá', 'card.selfcare.description': 'Dedícate tiempo', 'card.weather.title': 'Tiempo para el bebé', 'card.weather.description': 'Información meteorológica actual', 'card.shop.title': 'Tienda Lotti Baby', 'card.shop.description': 'Comprar estampados', 'card.weight.title': 'Curva de peso', 'card.weight.description': 'Registrar el peso', 'card.size.title': 'Curva de crecimiento', 'card.size.description': 'Registrar la altura del bebé', 'card.teeth.title': 'Seguimiento dental', 'card.teeth.description': 'Primeros dientecitos', 'card.milestones.title': 'Hitos', 'card.milestones.description': 'Guardar sus primeras veces',
  'timer.sleep.label': 'Seguimiento del sueño', 'timer.sleep.title': 'Hora de dormir', 'timer.sleep.titleNamed': '{{name}} está durmiendo', 'timer.sleep.subtitle': 'Shhh, dulces sueños', 'timer.sleep.progress': 'hoy {{done}} de unas {{target}}', 'timer.sleep.hint': 'Toca para ir directamente al seguimiento del sueño', 'timer.breast': 'Lactancia en curso', 'timer.bottle': 'Biberón en curso', 'timer.solids': 'Alimentación sólida en curso', 'timer.pump': 'Extracción en curso', 'timer.water': 'Agua en curso', 'timer.daily.label': 'Nuestro día', 'timer.daily.hint': 'Toca para continuar en «Nuestro día»', 'timer.since': 'desde las {{time}}',
  'alert.keepTile': 'Debe quedar visible al menos un acceso rápido.', 'alert.unknownEntry': 'Tipo de entrada desconocido. Inténtalo de nuevo.', 'alert.entrySaveFailed': 'No se pudo guardar la entrada.', 'alert.signInForSleep': 'Inicia sesión para guardar el sueño.', 'alert.sleepSaveFailed': 'No se pudo guardar el sueño.', 'alert.sleepEntrySaveFailed': 'No se pudo guardar la entrada de sueño.',
  'greeting.fallbackName': 'Mamá', 'greeting.hello': '¡Hola, {{name}}!', 'summary.title': 'Tu día de un vistazo', 'summary.noMeal': 'No hay tomas hoy', 'summary.bottle': 'Biberón {{count}}×', 'summary.breast': 'Lactancia {{count}}×', 'summary.solids': 'Sólidos {{count}}×', 'summary.pump': 'Extracción {{count}}×', 'summary.water': 'Agua {{count}}×', 'summary.breastOnly': 'Lactancia', 'summary.solidsOnly': 'Sólidos', 'summary.diapers': 'Pañales', 'summary.sleep': 'Sueño',
  'shop.button': 'Tienda', 'shop.accessibility': 'Abrir la tienda Lotti Baby', 'shop.eyebrow': 'Tienda Lotti Baby', 'shop.title': 'Estampados termoadhesivos', 'shop.description': 'Elige tu diseño favorito y pídelo directamente', 'shop.empty': 'Ver y pedir estampados.',
  'premium.advisor': 'Los cuidados de Lotti', 'premium.advisorDescription': 'Consejos personales sobre sueño, tiempo y nutrición', 'premium.voice': 'Registrar por voz', 'premium.voiceDescription': 'Registra sueño, alimentación, pañales, lista de la compra y planificador con tu voz', 'premium.askLotti': 'Pregunta a Lotti', 'premium.askLottiDescription': 'Orientación diaria, personalizada si es relevante',
  'quick.hideAccessibility': 'Ocultar {{title}}', 'quick.hiddenTitle': 'Ocultos', 'quick.hidden.one': 'Hay 1 acceso oculto.', 'quick.hidden.other': 'Hay {{count}} accesos ocultos.', 'quick.restoreAll': 'Mostrar todos', 'quick.restoreHint': 'Toca un acceso oculto para volver a mostrarlo.', 'quick.restore': 'Mostrar', 'quick.title': 'Acceso rápido', 'quick.done': 'Listo', 'quick.editHint': 'Mueve u oculta accesos y pulsa «Listo» para guardar.', 'quick.longPressHint': 'Mantén pulsado un acceso para cambiar el orden.', 'quick.hiddenHint': 'Puedes volver a mostrar abajo los accesos ocultos.', 'loading.title': 'Cargando tu resumen personal …', 'loading.refresh': 'Actualizando …',
};

export const HOME_TRANSLATIONS: Record<HomeLocale, Catalog> = { de, en, es };
export const getHomeLocaleTag = (locale: HomeLocale) => ({ de: 'de-DE', en: 'en-US', es: 'es-ES' })[locale];
export const translateHomeText = (locale: HomeLocale, key: HomeTranslationKey, params: Record<string, string | number> = {}) => {
  const template = HOME_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params[token] ?? `{{${token}}}`));
};
