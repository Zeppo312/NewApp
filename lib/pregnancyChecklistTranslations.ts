/** Translation boundary for the pregnancy hospital-bag checklist and its editor. */
export type PregnancyChecklistLocale = 'de' | 'en' | 'es';
export const DEFAULT_PREGNANCY_CHECKLIST_LOCALE: PregnancyChecklistLocale = 'de';

const de = {
  'common.error': 'Fehler',
  'common.cancel': 'Abbrechen',
  'common.delete': 'Löschen',
  'screen.title': 'Krankenhaus-Checkliste',
  'screen.subtitle': 'Alles, was du für die Klinik brauchst',
  'summary.title': 'Bereit für den großen Tag',
  'summary.description': 'Deine Liste wächst mit dir – hake ab, ergänze und bleib entspannt.',
  'summary.categories': '{{count}} Kategorien',
  'summary.completed': '{{completed}}/{{total}} erledigt',
  'progress.start': 'Starte mit den wichtigsten Dokumenten – so bleibt alles entspannt.',
  'progress.middle': 'Du bist mittendrin! Kleine Schritte bringen dich ans Ziel.',
  'progress.almost': 'Nur noch ein paar Teile – der große Tag kann kommen.',
  'progress.done': 'Wow, fast erledigt! Lass dir nur die letzten Kleinigkeiten bestätigen.',
  'state.loading': 'Checkliste wird geladen …',
  'state.empty': 'Deine Checkliste ist noch leer. Füge unten neue Einträge hinzu.',
  'state.categoryEmpty': 'Keine Einträge in dieser Kategorie',
  'action.retry': 'Erneut versuchen',
  'tip.review': 'Tipp: Überprüfe am Abend vor der Abreise alles noch einmal gemeinsam mit deiner Begleitung.',
  'add.title': 'Neuer Eintrag',
  'add.hint': 'Wunsch ergänzen und direkt abhaken',
  'add.name': 'Name *',
  'add.namePlaceholder': 'z. B. Mutterpass',
  'add.category': 'Kategorie',
  'add.notes': 'Notizen',
  'add.notesPlaceholder': 'Zusätzliche Informationen',
  'add.idle': 'Hinzufügen',
  'add.pending': 'Wird hinzugefügt …',
  'error.load': 'Die Checkliste konnte nicht geladen werden.',
  'error.nameRequired': 'Bitte gib einen Namen für den Eintrag ein.',
  'error.add': 'Der Eintrag konnte nicht hinzugefügt werden.',
  'error.toggle': 'Der Status konnte nicht geändert werden.',
  'error.delete': 'Der Eintrag konnte nicht gelöscht werden.',
  'delete.title': 'Eintrag löschen',
  'delete.confirm': 'Möchtest du diesen Eintrag wirklich löschen?',
} as const;

export type PregnancyChecklistTranslationKey = keyof typeof de;
type Catalog = Record<PregnancyChecklistTranslationKey, string>;

const en: Catalog = {
  'common.error': 'Error', 'common.cancel': 'Cancel', 'common.delete': 'Delete',
  'screen.title': 'Hospital bag checklist', 'screen.subtitle': 'Everything you need for the hospital',
  'summary.title': 'Ready for the big day', 'summary.description': 'Your list grows with you – tick things off, add what you need, and stay relaxed.',
  'summary.categories': '{{count}} categories', 'summary.completed': '{{completed}}/{{total}} done',
  'progress.start': 'Start with the essential documents so everything stays relaxed.',
  'progress.middle': 'You are well on your way! Small steps will get you there.',
  'progress.almost': 'Just a few things left – the big day can come.',
  'progress.done': 'Almost there! Just double-check the final little things.',
  'state.loading': 'Loading checklist …', 'state.empty': 'Your checklist is still empty. Add a new item below.',
  'state.categoryEmpty': 'No items in this category', 'action.retry': 'Try again',
  'tip.review': 'Tip: Go through everything once more with your support person on the evening before you leave.',
  'add.title': 'New item', 'add.hint': 'Add something and tick it off right away', 'add.name': 'Name *',
  'add.namePlaceholder': 'e.g. maternity record', 'add.category': 'Category', 'add.notes': 'Notes',
  'add.notesPlaceholder': 'Additional information', 'add.idle': 'Add', 'add.pending': 'Adding …',
  'error.load': 'The checklist could not be loaded.', 'error.nameRequired': 'Please enter a name for the item.',
  'error.add': 'The item could not be added.', 'error.toggle': 'The status could not be changed.',
  'error.delete': 'The item could not be deleted.', 'delete.title': 'Delete item',
  'delete.confirm': 'Do you really want to delete this item?',
};

const es: Catalog = {
  'common.error': 'Error', 'common.cancel': 'Cancelar', 'common.delete': 'Eliminar',
  'screen.title': 'Lista para el hospital', 'screen.subtitle': 'Todo lo que necesitas para el hospital',
  'summary.title': 'Todo listo para el gran día', 'summary.description': 'Tu lista crece contigo: marca, añade y prepárate con calma.',
  'summary.categories': '{{count}} categorías', 'summary.completed': '{{completed}}/{{total}} completados',
  'progress.start': 'Empieza por los documentos más importantes para tenerlo todo bajo control.',
  'progress.middle': '¡Ya estás en marcha! Los pequeños pasos te acercan a la meta.',
  'progress.almost': 'Solo faltan unas pocas cosas: el gran día puede llegar.',
  'progress.done': '¡Casi terminado! Solo queda confirmar los últimos detalles.',
  'state.loading': 'Cargando la lista …', 'state.empty': 'Tu lista todavía está vacía. Añade una entrada abajo.',
  'state.categoryEmpty': 'No hay entradas en esta categoría', 'action.retry': 'Volver a intentar',
  'tip.review': 'Consejo: la noche antes de salir, revisadlo todo una vez más junto con la persona que te acompañará.',
  'add.title': 'Nueva entrada', 'add.hint': 'Añade algo y márcalo cuando esté listo', 'add.name': 'Nombre *',
  'add.namePlaceholder': 'p. ej., cartilla de embarazo', 'add.category': 'Categoría', 'add.notes': 'Notas',
  'add.notesPlaceholder': 'Información adicional', 'add.idle': 'Añadir', 'add.pending': 'Añadiendo …',
  'error.load': 'No se pudo cargar la lista.', 'error.nameRequired': 'Introduce un nombre para la entrada.',
  'error.add': 'No se pudo añadir la entrada.', 'error.toggle': 'No se pudo cambiar el estado.',
  'error.delete': 'No se pudo eliminar la entrada.', 'delete.title': 'Eliminar entrada',
  'delete.confirm': '¿Seguro que quieres eliminar esta entrada?',
};

export const PREGNANCY_CHECKLIST_TRANSLATIONS: Record<PregnancyChecklistLocale, Catalog> = { de, en, es };

export type HospitalChecklistCategoryId = 'documents' | 'motherClothes' | 'babyClothes' | 'toiletries' | 'other';
export type HospitalChecklistItemId =
  | 'maternityRecord' | 'identityCard' | 'insuranceCard' | 'familyRecord' | 'birthPlan'
  | 'nightgowns' | 'warmSocks' | 'robe' | 'nursingBras' | 'underwear' | 'slippers' | 'goingHomeClothes'
  | 'bodysuits' | 'rompers' | 'babyHats' | 'babySocks' | 'babyJacket' | 'babyGoingHomeOutfit'
  | 'toothbrush' | 'hairbrush' | 'showerGel' | 'maternityPads' | 'nippleCream' | 'lipBalm' | 'babyWipes' | 'newbornDiapers'
  | 'towels' | 'washcloths' | 'phoneCharger' | 'snacks' | 'camera' | 'reading' | 'carSeat';

export interface LocalizedHospitalChecklistItem {
  id: HospitalChecklistItemId;
  name: string;
  categoryId: HospitalChecklistCategoryId;
  notes: string | null;
}

const categories: Record<PregnancyChecklistLocale, Record<HospitalChecklistCategoryId, string>> = {
  de: { documents: 'Dokumente', motherClothes: 'Kleidung für Mama', babyClothes: 'Kleidung für Baby', toiletries: 'Hygieneartikel', other: 'Sonstiges' },
  en: { documents: 'Documents', motherClothes: 'Clothes for mom', babyClothes: 'Clothes for baby', toiletries: 'Toiletries', other: 'Other' },
  es: { documents: 'Documentos', motherClothes: 'Ropa para mamá', babyClothes: 'Ropa para el bebé', toiletries: 'Artículos de aseo', other: 'Otros' },
};

const itemRows: [HospitalChecklistItemId, HospitalChecklistCategoryId, string, string, string, string | null, string | null, string | null][] = [
  ['maternityRecord', 'documents', 'Mutterpass', 'Maternity record', 'Cartilla de embarazo', 'Unbedingt mitnehmen!', 'Essential!', '¡Imprescindible!'],
  ['identityCard', 'documents', 'Personalausweis', 'Identity document', 'Documento de identidad', null, null, null],
  ['insuranceCard', 'documents', 'Krankenversicherungskarte', 'Health insurance card', 'Tarjeta sanitaria', null, null, null],
  ['familyRecord', 'documents', 'Familienstammbuch', 'Family record book', 'Libro de familia', null, null, null],
  ['birthPlan', 'documents', 'Geburtsplan (falls vorhanden)', 'Birth plan (if available)', 'Plan de parto (si lo tienes)', null, null, null],
  ['nightgowns', 'motherClothes', 'Bequeme Nachthemden', 'Comfortable nightgowns', 'Camisones cómodos', '2–3 Stück', '2–3', '2–3'],
  ['warmSocks', 'motherClothes', 'Warme Socken', 'Warm socks', 'Calcetines abrigados', null, null, null],
  ['robe', 'motherClothes', 'Bademantel', 'Bathrobe', 'Albornoz', null, null, null],
  ['nursingBras', 'motherClothes', 'Stillbustier/Still-BHs', 'Nursing bras', 'Sujetadores de lactancia', '2–3 Stück', '2–3', '2–3'],
  ['underwear', 'motherClothes', 'Bequeme Unterwäsche', 'Comfortable underwear', 'Ropa interior cómoda', 'Mehrere Stück', 'Several pairs', 'Varias prendas'],
  ['slippers', 'motherClothes', 'Hausschuhe', 'Slippers', 'Zapatillas', null, null, null],
  ['goingHomeClothes', 'motherClothes', 'Bequeme Kleidung für die Heimreise', 'Comfortable clothes for going home', 'Ropa cómoda para volver a casa', null, null, null],
  ['bodysuits', 'babyClothes', 'Bodys', 'Bodysuits', 'Bodies', '4–5 Stück, Größe 50/56', '4–5, size 50/56', '4–5, talla 50/56'],
  ['rompers', 'babyClothes', 'Strampler', 'Rompers', 'Pijamas de una pieza', '2–3 Stück, Größe 50/56', '2–3, size 50/56', '2–3, talla 50/56'],
  ['babyHats', 'babyClothes', 'Mützchen', 'Baby hats', 'Gorritos', null, null, null],
  ['babySocks', 'babyClothes', 'Söckchen', 'Baby socks', 'Calcetines', '2–3 Paar', '2–3 pairs', '2–3 pares'],
  ['babyJacket', 'babyClothes', 'Jäckchen', 'Baby jacket', 'Chaqueta', 'Je nach Jahreszeit', 'Depending on the season', 'Según la estación'],
  ['babyGoingHomeOutfit', 'babyClothes', 'Heimfahrt-Outfit', 'Going-home outfit', 'Conjunto para volver a casa', 'Wettergerecht', 'Suitable for the weather', 'Adecuado al tiempo'],
  ['toothbrush', 'toiletries', 'Zahnbürste & Zahnpasta', 'Toothbrush & toothpaste', 'Cepillo y pasta de dientes', null, null, null],
  ['hairbrush', 'toiletries', 'Haarbürste & Haargummis', 'Hairbrush & hair ties', 'Cepillo y gomas para el pelo', null, null, null],
  ['showerGel', 'toiletries', 'Duschgel & Shampoo', 'Shower gel & shampoo', 'Gel de ducha y champú', null, null, null],
  ['maternityPads', 'toiletries', 'Wochenbetteinlagen', 'Maternity pads', 'Compresas posparto', null, null, null],
  ['nippleCream', 'toiletries', 'Brustwarzensalbe', 'Nipple cream', 'Crema para pezones', null, null, null],
  ['lipBalm', 'toiletries', 'Lippenpflegestift', 'Lip balm', 'Bálsamo labial', null, null, null],
  ['babyWipes', 'toiletries', 'Feuchttücher für Baby', 'Baby wipes', 'Toallitas para el bebé', null, null, null],
  ['newbornDiapers', 'toiletries', 'Windeln für Neugeborene', 'Newborn diapers', 'Pañales para recién nacido', 'Kleine Packung', 'Small pack', 'Paquete pequeño'],
  ['towels', 'other', 'Handtücher', 'Towels', 'Toallas', '2 Stück', '2', '2'],
  ['washcloths', 'other', 'Waschlappen', 'Washcloths', 'Toallitas de tela', '2–3 Stück', '2–3', '2–3'],
  ['phoneCharger', 'other', 'Handy & Ladekabel', 'Phone & charging cable', 'Móvil y cargador', null, null, null],
  ['snacks', 'other', 'Snacks & Getränke', 'Snacks & drinks', 'Tentempiés y bebidas', null, null, null],
  ['camera', 'other', 'Kamera', 'Camera', 'Cámara', null, null, null],
  ['reading', 'other', 'Lektüre/Zeitschriften', 'Books/magazines', 'Lecturas/revistas', null, null, null],
  ['carSeat', 'other', 'Maxi-Cosi/Babyschale für Heimfahrt', 'Infant car seat for going home', 'Silla de coche para volver a casa', null, null, null],
];

export const getHospitalChecklistCategories = (locale: PregnancyChecklistLocale) =>
  (Object.keys(categories.de) as HospitalChecklistCategoryId[]).map((id) => ({ id, label: categories[locale][id] }));

export const getHospitalChecklistDefaultItems = (locale: PregnancyChecklistLocale): LocalizedHospitalChecklistItem[] => {
  const nameIndex = locale === 'de' ? 2 : locale === 'en' ? 3 : 4;
  const noteIndex = locale === 'de' ? 5 : locale === 'en' ? 6 : 7;
  return itemRows.map((row) => ({ id: row[0], categoryId: row[1], name: row[nameIndex] as string, notes: row[noteIndex] as string | null }));
};

export const translatePregnancyChecklistText = (
  locale: PregnancyChecklistLocale,
  key: PregnancyChecklistTranslationKey,
  params: Record<string, string | number> = {},
) => (PREGNANCY_CHECKLIST_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key)
  .replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params[token] ?? `{{${token}}}`));
