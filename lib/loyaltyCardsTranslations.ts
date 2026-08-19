import type { AppLocale } from '@/lib/localization';

const translations = {
  de: {
    loadTitle: 'Nicht geladen', loadMessage: 'Deine Kundenkarten konnten nicht geladen werden.',
    cameraTitle: 'Kamera nicht erlaubt', cameraMessage: 'Du kannst die Kartennummer stattdessen unten manuell eingeben.',
    unsupportedTitle: 'Barcode noch nicht unterstützt', unsupportedMessage: 'Unterstützt werden lineare Barcodes mit Zahlen und lateinischen Zeichen.',
    nameMissingTitle: 'Name fehlt', nameMissingMessage: 'Gib der Karte bitte einen Namen.',
    barcodeMissingTitle: 'Barcode fehlt', barcodeMissingMessage: 'Scanne den Barcode oder gib die Kartennummer ein.',
    numberUnsupportedTitle: 'Kartennummer nicht unterstützt', numberUnsupportedMessage: 'Verwende bitte nur Zahlen und lateinische Zeichen ohne Umlaute.',
    saveFailedTitle: 'Nicht gespeichert', saveFailedMessage: 'Die Karte konnte nicht gespeichert werden.',
    deleteTitle: 'Karte löschen', deleteMessage: '„{{name}}“ wirklich entfernen?', cancel: 'Abbrechen', delete: 'Löschen',
    deleteFailedTitle: 'Nicht gelöscht', deleteFailedMessage: 'Die Karte konnte nicht gelöscht werden.',
    title: 'Kundenkarten', subtitle: 'Beim Einkauf schnell griffbereit', introTitle: 'Deine Karten an einem Ort',
    introText: 'Barcode einmal scannen und an der Kasse jederzeit wieder öffnen. Die Daten bleiben auf diesem Gerät.',
    loading: 'Karten werden geladen …', emptyTitle: 'Noch keine Kundenkarte',
    emptyText: 'Starte zum Testen zum Beispiel mit PAYBACK, Kaufland Card oder EDEKA.', firstCard: 'Erste Karte hinzufügen',
    myCards: 'Meine Karten', openHint: 'Öffnet den Barcode in groß', openCard: '{{name}} öffnen', addCard: 'Karte hinzufügen',
    addSubtitle: 'Anbieter wählen und Barcode übernehmen', close: 'Schließen', provider: 'Anbieter', otherCard: 'Andere Karte',
    cardName: 'Name der Karte', cardNamePlaceholder: 'z. B. PAYBACK', barcode: 'Barcode', scan: 'Barcode scannen',
    scanHint: 'Kamera auf den Code der Karte richten', manualDivider: 'oder manuell', numberPlaceholder: 'Kartennummer eingeben',
    entered: 'Eingetragen', scanned: '{{type}} gescannt', saving: 'Wird gespeichert …', saveCard: 'Karte speichern',
    closeScanner: 'Scanner schließen', scannerTitle: 'Kartenbarcode scannen', scannerHint: 'Barcode vollständig in den Rahmen halten',
    zoom: 'Zoom {{zoom}}', flashlight: 'Taschenlampe',
    closeCard: 'Karte schließen', deleteCard: 'Karte löschen', detailTitle: 'Kundenkarte', checkoutHint: 'Diesen Code an der Kasse vorzeigen',
    brightnessHint: 'Bei Scanproblemen die Displayhelligkeit kurz erhöhen.', manual: 'Manuell',
  },
  en: {
    loadTitle: 'Could not load', loadMessage: 'Your loyalty cards could not be loaded.',
    cameraTitle: 'Camera access denied', cameraMessage: 'You can enter the card number manually below instead.',
    unsupportedTitle: 'Barcode not supported yet', unsupportedMessage: 'Linear barcodes containing numbers and Latin characters are supported.',
    nameMissingTitle: 'Name missing', nameMissingMessage: 'Please give the card a name.',
    barcodeMissingTitle: 'Barcode missing', barcodeMissingMessage: 'Scan the barcode or enter the card number.',
    numberUnsupportedTitle: 'Card number not supported', numberUnsupportedMessage: 'Please use only numbers and Latin characters.',
    saveFailedTitle: 'Not saved', saveFailedMessage: 'The card could not be saved.',
    deleteTitle: 'Delete card', deleteMessage: 'Really remove “{{name}}”?', cancel: 'Cancel', delete: 'Delete',
    deleteFailedTitle: 'Not deleted', deleteFailedMessage: 'The card could not be deleted.',
    title: 'Loyalty cards', subtitle: 'Ready when you shop', introTitle: 'All your cards in one place',
    introText: 'Scan a barcode once and open it anytime at checkout. The data stays on this device.',
    loading: 'Loading cards …', emptyTitle: 'No loyalty cards yet',
    emptyText: 'Start with a card such as PAYBACK, Kaufland Card, or EDEKA.', firstCard: 'Add first card',
    myCards: 'My cards', openHint: 'Opens the barcode in a large view', openCard: 'Open {{name}}', addCard: 'Add card',
    addSubtitle: 'Choose a provider and capture the barcode', close: 'Close', provider: 'Provider', otherCard: 'Other card',
    cardName: 'Card name', cardNamePlaceholder: 'e.g. PAYBACK', barcode: 'Barcode', scan: 'Scan barcode',
    scanHint: 'Point the camera at the card barcode', manualDivider: 'or enter manually', numberPlaceholder: 'Enter card number',
    entered: 'Entered', scanned: '{{type}} scanned', saving: 'Saving …', saveCard: 'Save card',
    closeScanner: 'Close scanner', scannerTitle: 'Scan card barcode', scannerHint: 'Keep the entire barcode inside the frame',
    zoom: 'Zoom {{zoom}}', flashlight: 'Flashlight',
    closeCard: 'Close card', deleteCard: 'Delete card', detailTitle: 'Loyalty card', checkoutHint: 'Show this code at checkout',
    brightnessHint: 'If scanning fails, briefly increase your screen brightness.', manual: 'Manual',
  },
  es: {
    loadTitle: 'No se pudo cargar', loadMessage: 'No se pudieron cargar tus tarjetas de fidelización.',
    cameraTitle: 'Cámara no autorizada', cameraMessage: 'Puedes introducir el número de tarjeta manualmente abajo.',
    unsupportedTitle: 'Código aún no compatible', unsupportedMessage: 'Se admiten códigos lineales con números y caracteres latinos.',
    nameMissingTitle: 'Falta el nombre', nameMissingMessage: 'Ponle un nombre a la tarjeta.',
    barcodeMissingTitle: 'Falta el código', barcodeMissingMessage: 'Escanea el código o introduce el número de tarjeta.',
    numberUnsupportedTitle: 'Número no compatible', numberUnsupportedMessage: 'Usa solo números y caracteres latinos.',
    saveFailedTitle: 'No se guardó', saveFailedMessage: 'No se pudo guardar la tarjeta.',
    deleteTitle: 'Eliminar tarjeta', deleteMessage: '¿Quieres eliminar “{{name}}”?', cancel: 'Cancelar', delete: 'Eliminar',
    deleteFailedTitle: 'No se eliminó', deleteFailedMessage: 'No se pudo eliminar la tarjeta.',
    title: 'Tarjetas de fidelización', subtitle: 'Listas para tus compras', introTitle: 'Todas tus tarjetas en un solo lugar',
    introText: 'Escanea el código una vez y ábrelo cuando quieras en caja. Los datos permanecen en este dispositivo.',
    loading: 'Cargando tarjetas …', emptyTitle: 'Aún no hay tarjetas',
    emptyText: 'Empieza, por ejemplo, con PAYBACK, Kaufland Card o EDEKA.', firstCard: 'Añadir primera tarjeta',
    myCards: 'Mis tarjetas', openHint: 'Abre el código en vista ampliada', openCard: 'Abrir {{name}}', addCard: 'Añadir tarjeta',
    addSubtitle: 'Elige un proveedor y captura el código', close: 'Cerrar', provider: 'Proveedor', otherCard: 'Otra tarjeta',
    cardName: 'Nombre de la tarjeta', cardNamePlaceholder: 'p. ej., PAYBACK', barcode: 'Código de barras', scan: 'Escanear código',
    scanHint: 'Apunta la cámara al código de la tarjeta', manualDivider: 'o introdúcelo manualmente', numberPlaceholder: 'Introduce el número',
    entered: 'Introducido', scanned: '{{type}} escaneado', saving: 'Guardando …', saveCard: 'Guardar tarjeta',
    closeScanner: 'Cerrar escáner', scannerTitle: 'Escanear código de la tarjeta', scannerHint: 'Mantén todo el código dentro del marco',
    zoom: 'Zoom {{zoom}}', flashlight: 'Linterna',
    closeCard: 'Cerrar tarjeta', deleteCard: 'Eliminar tarjeta', detailTitle: 'Tarjeta de fidelización', checkoutHint: 'Muestra este código en caja',
    brightnessHint: 'Si hay problemas al escanear, aumenta brevemente el brillo de la pantalla.', manual: 'Manual',
  },
} as const;

export type LoyaltyCardsTranslationKey = keyof typeof translations.de;

export const translateLoyaltyCards = (
  locale: AppLocale,
  key: LoyaltyCardsTranslationKey,
  params?: Record<string, string | number>,
) => {
  let value: string = translations[locale][key] ?? translations.de[key];
  if (params) {
    for (const [name, replacement] of Object.entries(params)) {
      value = value.replaceAll(`{{${name}}}`, String(replacement));
    }
  }
  return value;
};
