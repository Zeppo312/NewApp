/** Translation boundary for baby-name discovery, favorites, and admin editing. */
export type BabyNamesLocale = 'de' | 'en' | 'es';
export const DEFAULT_BABY_NAMES_LOCALE: BabyNamesLocale = 'de';

const de = {
  'common.error': 'Fehler', 'common.notice': 'Hinweis', 'common.success': 'Erfolg', 'common.cancel': 'Abbrechen', 'common.delete': 'Löschen',
  'screen.title': 'Babynamen', 'screen.subtitle': 'Finde den perfekten Namen für dein Baby', 'screen.previewSubtitle': 'Vorschau-Modus: nur ansehen',
  'preview.title': 'Nur Vorschau aktiv', 'preview.alertTitle': 'Nur Vorschau', 'preview.description': 'Du schaust den Schwangerschaftsmodus an. Babynamen sind hier gesperrt.',
  'search.placeholder': 'Suche nach Namen …', 'filter.allLetters': 'Alle', 'category.all': 'Alle Namen', 'category.male': 'Jungennamen',
  'category.female': 'Mädchennamen', 'category.favorites': 'Favoriten', 'state.loading': 'Lade Namen …', 'state.noResults': 'Keine Namen gefunden.',
  'state.noFavorites': 'Du hast noch keine Favoriten gespeichert.', 'action.showAll': 'Alle Namen anzeigen',
  'field.name': 'Name', 'field.meaning': 'Bedeutung', 'field.origin': 'Herkunft', 'field.gender': 'Geschlecht',
  'gender.male': 'Männlich', 'gender.female': 'Weiblich', 'gender.unisex': 'Unisex', 'value.unknownMeaning': 'Bedeutung unbekannt',
  'value.unknownOrigin': 'Herkunft unbekannt', 'favorite.signIn': 'Du musst angemeldet sein, um Favoriten zu speichern.',
  'favorite.loadFailed': 'Favoriten konnten nicht geladen werden.', 'favorite.addFailed': 'Favorit konnte nicht hinzugefügt werden.',
  'favorite.removeFailed': 'Favorit konnte nicht entfernt werden.', 'error.unexpected': 'Ein unerwarteter Fehler ist aufgetreten.',
  'admin.addTitle': 'Neuen Namen hinzufügen', 'admin.editTitle': 'Name bearbeiten', 'admin.single': 'Einzeln', 'admin.bulk': 'SQL-Import',
  'admin.namePlaceholder': 'z. B. Mila', 'admin.meaningPlaceholder': 'z. B. Wunder, Hoffnung', 'admin.originPlaceholder': 'z. B. Hebräisch',
  'admin.sql': 'SQL-Skript', 'admin.validateSql': 'SQL prüfen', 'admin.bulkHint': 'Prüfe die Einträge, passe sie an und speichere.',
  'admin.onlyAdmins': 'Nur Admins können Babynamen hinzufügen.', 'admin.nameRequired': 'Bitte gib einen Namen ein.',
  'admin.duplicate': 'Dieser Name existiert bereits.', 'admin.databaseDuplicate': 'Name existiert bereits in der Datenbank.',
  'admin.sqlRequired': 'Bitte zuerst das SQL-Skript einfügen.', 'admin.added': '{{count}} Namen wurden hinzugefügt.',
  'admin.savedAdded': 'Der Name wurde hinzugefügt.', 'admin.savedUpdated': 'Der Name wurde aktualisiert.',
  'admin.unnamed': 'Unbenannt', 'admin.invalidSql': 'Keine gültigen Werte gefunden. Bitte das INSERT-VALUES-Format prüfen.',
  'admin.expectedValues': 'Erwartet 6 Werte, gefunden {{count}}.', 'admin.nameMissing': 'Name fehlt.',
  'admin.nameNotText': 'Name fehlt oder ist nicht als Text angegeben.', 'admin.meaningNotText': 'Bedeutung muss Text (in einfachen Anführungszeichen) oder NULL sein.',
  'admin.originNotText': 'Herkunft muss Text (in einfachen Anführungszeichen) oder NULL sein.', 'admin.genderNotText': 'Geschlecht muss als Text angegeben werden.',
  'admin.genderMissing': 'Geschlecht fehlt.', 'admin.genderInvalid': 'Geschlecht muss female, male oder unisex sein.',
  'admin.listDuplicate': 'Name ist in der Liste doppelt.', 'admin.errorAt': 'Fehler bei „{{name}}“: {{error}}',
  'admin.unknown': 'Unbekannt', 'admin.unknownError': 'Unbekannter Fehler', 'admin.atLeastOneDuplicate': 'Mindestens ein Name existiert bereits in der Datenbank.',
  'delete.title': 'Name löschen', 'delete.confirm': 'Möchtest du „{{name}}“ wirklich entfernen?', 'delete.success': 'Der Name wurde gelöscht.',
  'delete.failed': 'Der Name konnte nicht gelöscht werden.',
} as const;
export type BabyNamesTranslationKey = keyof typeof de;
type Catalog = Record<BabyNamesTranslationKey, string>;

const en: Catalog = {
  'common.error': 'Error', 'common.notice': 'Note', 'common.success': 'Success', 'common.cancel': 'Cancel', 'common.delete': 'Delete',
  'screen.title': 'Baby names', 'screen.subtitle': 'Find the perfect name for your baby', 'screen.previewSubtitle': 'Preview mode: view only',
  'preview.title': 'Preview only', 'preview.alertTitle': 'Preview only', 'preview.description': 'You are previewing pregnancy mode. Baby names are locked here.',
  'search.placeholder': 'Search names …', 'filter.allLetters': 'All', 'category.all': 'All names', 'category.male': 'Boy names',
  'category.female': 'Girl names', 'category.favorites': 'Favorites', 'state.loading': 'Loading names …', 'state.noResults': 'No names found.',
  'state.noFavorites': 'You have not saved any favorites yet.', 'action.showAll': 'Show all names', 'field.name': 'Name',
  'field.meaning': 'Meaning', 'field.origin': 'Origin', 'field.gender': 'Gender', 'gender.male': 'Male', 'gender.female': 'Female',
  'gender.unisex': 'Unisex', 'value.unknownMeaning': 'Meaning unknown', 'value.unknownOrigin': 'Origin unknown',
  'favorite.signIn': 'You must be signed in to save favorites.', 'favorite.loadFailed': 'Favorites could not be loaded.',
  'favorite.addFailed': 'The favorite could not be added.', 'favorite.removeFailed': 'The favorite could not be removed.',
  'error.unexpected': 'An unexpected error occurred.', 'admin.addTitle': 'Add a new name', 'admin.editTitle': 'Edit name',
  'admin.single': 'Single', 'admin.bulk': 'SQL import', 'admin.namePlaceholder': 'e.g. Mila', 'admin.meaningPlaceholder': 'e.g. miracle, hope',
  'admin.originPlaceholder': 'e.g. Hebrew', 'admin.sql': 'SQL script', 'admin.validateSql': 'Validate SQL',
  'admin.bulkHint': 'Review the entries, make any changes, and save.', 'admin.onlyAdmins': 'Only admins can add baby names.',
  'admin.nameRequired': 'Please enter a name.', 'admin.duplicate': 'This name already exists.', 'admin.databaseDuplicate': 'The name already exists in the database.',
  'admin.sqlRequired': 'Paste the SQL script first.', 'admin.added': '{{count}} names were added.', 'admin.savedAdded': 'The name was added.',
  'admin.savedUpdated': 'The name was updated.', 'delete.title': 'Delete name', 'delete.confirm': 'Do you really want to remove “{{name}}”?',
  'admin.unnamed': 'Unnamed', 'admin.invalidSql': 'No valid values were found. Check the INSERT VALUES format.',
  'admin.expectedValues': 'Expected 6 values, found {{count}}.', 'admin.nameMissing': 'Name is missing.',
  'admin.nameNotText': 'The name is missing or is not provided as text.', 'admin.meaningNotText': 'Meaning must be text (in single quotes) or NULL.',
  'admin.originNotText': 'Origin must be text (in single quotes) or NULL.', 'admin.genderNotText': 'Gender must be provided as text.',
  'admin.genderMissing': 'Gender is missing.', 'admin.genderInvalid': 'Gender must be female, male, or unisex.',
  'admin.listDuplicate': 'The name is duplicated in the list.', 'admin.errorAt': 'Error for “{{name}}”: {{error}}',
  'admin.unknown': 'Unknown', 'admin.unknownError': 'Unknown error', 'admin.atLeastOneDuplicate': 'At least one name already exists in the database.',
  'delete.success': 'The name was deleted.', 'delete.failed': 'The name could not be deleted.',
};

const es: Catalog = {
  'common.error': 'Error', 'common.notice': 'Aviso', 'common.success': 'Éxito', 'common.cancel': 'Cancelar', 'common.delete': 'Eliminar',
  'screen.title': 'Nombres para bebés', 'screen.subtitle': 'Encuentra el nombre perfecto para tu bebé', 'screen.previewSubtitle': 'Modo de vista previa: solo lectura',
  'preview.title': 'Solo vista previa', 'preview.alertTitle': 'Solo vista previa', 'preview.description': 'Estás viendo el modo embarazo. Los nombres para bebés están bloqueados aquí.',
  'search.placeholder': 'Buscar nombres …', 'filter.allLetters': 'Todos', 'category.all': 'Todos los nombres', 'category.male': 'Nombres de niño',
  'category.female': 'Nombres de niña', 'category.favorites': 'Favoritos', 'state.loading': 'Cargando nombres …', 'state.noResults': 'No se encontraron nombres.',
  'state.noFavorites': 'Todavía no has guardado ningún favorito.', 'action.showAll': 'Mostrar todos los nombres', 'field.name': 'Nombre',
  'field.meaning': 'Significado', 'field.origin': 'Origen', 'field.gender': 'Género', 'gender.male': 'Masculino', 'gender.female': 'Femenino',
  'gender.unisex': 'Unisex', 'value.unknownMeaning': 'Significado desconocido', 'value.unknownOrigin': 'Origen desconocido',
  'favorite.signIn': 'Debes iniciar sesión para guardar favoritos.', 'favorite.loadFailed': 'No se pudieron cargar los favoritos.',
  'favorite.addFailed': 'No se pudo añadir el favorito.', 'favorite.removeFailed': 'No se pudo eliminar el favorito.',
  'error.unexpected': 'Se produjo un error inesperado.', 'admin.addTitle': 'Añadir un nombre nuevo', 'admin.editTitle': 'Editar nombre',
  'admin.single': 'Individual', 'admin.bulk': 'Importar SQL', 'admin.namePlaceholder': 'p. ej., Mila', 'admin.meaningPlaceholder': 'p. ej., milagro, esperanza',
  'admin.originPlaceholder': 'p. ej., hebreo', 'admin.sql': 'Script SQL', 'admin.validateSql': 'Validar SQL',
  'admin.bulkHint': 'Revisa las entradas, modifícalas si es necesario y guárdalas.', 'admin.onlyAdmins': 'Solo los administradores pueden añadir nombres.',
  'admin.nameRequired': 'Introduce un nombre.', 'admin.duplicate': 'Este nombre ya existe.', 'admin.databaseDuplicate': 'El nombre ya existe en la base de datos.',
  'admin.sqlRequired': 'Pega primero el script SQL.', 'admin.added': 'Se han añadido {{count}} nombres.', 'admin.savedAdded': 'El nombre se ha añadido.',
  'admin.savedUpdated': 'El nombre se ha actualizado.', 'delete.title': 'Eliminar nombre', 'delete.confirm': '¿Seguro que quieres eliminar «{{name}}»?',
  'admin.unnamed': 'Sin nombre', 'admin.invalidSql': 'No se encontraron valores válidos. Comprueba el formato INSERT VALUES.',
  'admin.expectedValues': 'Se esperaban 6 valores y se encontraron {{count}}.', 'admin.nameMissing': 'Falta el nombre.',
  'admin.nameNotText': 'Falta el nombre o no se ha indicado como texto.', 'admin.meaningNotText': 'El significado debe ser texto (entre comillas simples) o NULL.',
  'admin.originNotText': 'El origen debe ser texto (entre comillas simples) o NULL.', 'admin.genderNotText': 'El género debe indicarse como texto.',
  'admin.genderMissing': 'Falta el género.', 'admin.genderInvalid': 'El género debe ser female, male o unisex.',
  'admin.listDuplicate': 'El nombre está duplicado en la lista.', 'admin.errorAt': 'Error en «{{name}}»: {{error}}',
  'admin.unknown': 'Desconocido', 'admin.unknownError': 'Error desconocido', 'admin.atLeastOneDuplicate': 'Al menos un nombre ya existe en la base de datos.',
  'delete.success': 'El nombre se ha eliminado.', 'delete.failed': 'No se pudo eliminar el nombre.',
};

export const BABY_NAMES_TRANSLATIONS: Record<BabyNamesLocale, Catalog> = { de, en, es };
export const translateBabyNamesText = (locale: BabyNamesLocale, key: BabyNamesTranslationKey, params: Record<string, string | number> = {}) =>
  (BABY_NAMES_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key).replace(/\{\{(\w+)\}\}/g, (_, token: string) => String(params[token] ?? `{{${token}}}`));

export interface LocalizedFallbackBabyName { name: string; meaning: string; origin: string; gender: 'male' | 'female' | 'unisex' }
const fallbackRows: [string, 'male' | 'female' | 'unisex', string, string, string, string, string, string][] = [
  ['Noah', 'male', 'Ruhe, Trost', 'Rest, comfort', 'Descanso, consuelo', 'Hebräisch', 'Hebrew', 'Hebreo'],
  ['Leon', 'male', 'Löwe', 'Lion', 'León', 'Lateinisch', 'Latin', 'Latino'],
  ['Paul', 'male', 'Der Kleine, der Bescheidene', 'The small, humble one', 'El pequeño, el humilde', 'Lateinisch', 'Latin', 'Latino'],
  ['Ben', 'male', 'Sohn', 'Son', 'Hijo', 'Hebräisch', 'Hebrew', 'Hebreo'],
  ['Finn', 'male', 'Der Blonde, der Helle', 'The fair-haired, bright one', 'El rubio, el luminoso', 'Irisch', 'Irish', 'Irlandés'],
  ['Emma', 'female', 'Die Große, die Starke', 'The great, strong one', 'La grande, la fuerte', 'Germanisch', 'Germanic', 'Germánico'],
  ['Mia', 'female', 'Mein', 'Mine', 'Mía', 'Italienisch', 'Italian', 'Italiano'],
  ['Hannah', 'female', 'Die Anmutige', 'The gracious one', 'La llena de gracia', 'Hebräisch', 'Hebrew', 'Hebreo'],
  ['Emilia', 'female', 'Die Eifrige, die Fleißige', 'The eager, hardworking one', 'La diligente, la trabajadora', 'Lateinisch', 'Latin', 'Latino'],
  ['Lina', 'female', 'Die Zarte, die Milde', 'The gentle, tender one', 'La tierna, la dulce', 'Arabisch', 'Arabic', 'Árabe'],
  ['Alex', 'unisex', 'Der Beschützer', 'The protector', 'Quien protege', 'Griechisch', 'Greek', 'Griego'],
  ['Charlie', 'unisex', 'Die Freie', 'The free one', 'La persona libre', 'Germanisch', 'Germanic', 'Germánico'],
  ['Robin', 'unisex', 'Der Glänzende', 'The bright one', 'La persona brillante', 'Germanisch', 'Germanic', 'Germánico'],
  ['Kim', 'unisex', 'Der Kühne', 'The bold one', 'La persona valiente', 'Englisch', 'English', 'Inglés'],
  ['Noel', 'unisex', 'Weihnachten', 'Christmas', 'Navidad', 'Französisch', 'French', 'Francés'],
];

export const getLocalizedFallbackBabyNames = (locale: BabyNamesLocale): LocalizedFallbackBabyName[] => {
  const meaningIndex = locale === 'de' ? 2 : locale === 'en' ? 3 : 4;
  const originIndex = locale === 'de' ? 5 : locale === 'en' ? 6 : 7;
  return fallbackRows.map((row) => ({ name: row[0], gender: row[1], meaning: row[meaningIndex] as string, origin: row[originIndex] as string }));
};
