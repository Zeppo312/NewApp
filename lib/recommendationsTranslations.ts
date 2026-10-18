import type { AppLocale } from '@/lib/localization';

const copy = {
  de: {
    error: 'Fehler', success: 'Erfolg', cancel: 'Abbrechen', delete: 'Löschen', save: 'Speichern', ok: 'OK', unknownError: 'Unbekannter Fehler',
    loadFailed: 'Daten konnten nicht geladen werden.', permissionTitle: 'Berechtigung erforderlich', permissionMessage: 'Bitte erlaube den Zugriff auf deine Fotos.', imageFailed: 'Bild konnte nicht ausgewählt werden.',
    deleteTitle: 'Empfehlung löschen', deleteQuestion: 'Möchtest du „{{title}}“ wirklich löschen?', deleted: 'Empfehlung wurde gelöscht.', deleteFailed: 'Empfehlung konnte nicht gelöscht werden.',
    required: 'Bitte fülle alle Pflichtfelder aus.', uploadFailed: 'Upload fehlgeschlagen', uploadTip: '{{error}}\n\nTipp: Stelle sicher, dass der „public-images“-Bucket in Supabase existiert.', continueWithoutImage: 'Ohne Bild fortfahren',
    product: 'Zum Produkt', updated: 'Empfehlung wurde aktualisiert.', created: 'Empfehlung wurde erstellt.', saveFailed: 'Empfehlung konnte nicht gespeichert werden.\n\n{{error}}',
    linkUnsupported: 'Dieser Link kann nicht geöffnet werden.', linkFailed: 'Link konnte nicht geöffnet werden.', copiedTitle: '✅ Kopiert!', copiedMessage: 'Der Rabattcode „{{code}}“ wurde in die Zwischenablage kopiert.', copyFailed: 'Code konnte nicht kopiert werden.',
    favorite: 'Lottis Favorit', discountCode: 'Rabattcode:', reorderFailed: 'Reihenfolge konnte nicht gespeichert werden.', add: 'Neue Empfehlung', loading: 'Empfehlungen werden geladen …', emptyTitle: 'Noch keine Empfehlungen', emptyAdmin: 'Füge die erste Empfehlung hinzu!', emptyUser: 'Schau bald wieder vorbei für tolle Produktempfehlungen!',
    title: 'Lottis Empfehlungen', subtitle: 'Handverlesene Produkte für dich und dein Baby', editTitle: 'Empfehlung bearbeiten',
    fieldTitle: 'Titel *', titlePlaceholder: 'z. B. Beste Baby-Tragetasche', fieldDescription: 'Beschreibung *', descriptionPlaceholder: 'Beschreibe das Produkt …', fieldImage: 'Produktbild', changeImage: 'Bild ändern', chooseImage: 'Bild auswählen', or: 'oder', imageUrlPlaceholder: 'Bild-URL eingeben (https://…)', fieldLink: 'Produkt-Link *',
    favoriteHint: 'Optional: Zeigt den angepinnten Favorit-Badge', fieldButton: 'Button-Text', buttonHint: 'Optional: Standard ist „Zum Produkt“', fieldDiscount: 'Rabattcode', discountPlaceholder: 'z. B. LOTTI10', discountHint: 'Optional: Code für den Checkout (z. B. LOTTI10 für 10 % Rabatt)', uploading: 'Bild wird hochgeladen …', saving: 'Wird gespeichert …',
  },
  en: {
    error: 'Error', success: 'Success', cancel: 'Cancel', delete: 'Delete', save: 'Save', ok: 'OK', unknownError: 'Unknown error',
    loadFailed: 'The data could not be loaded.', permissionTitle: 'Permission required', permissionMessage: 'Please allow access to your photos.', imageFailed: 'The image could not be selected.',
    deleteTitle: 'Delete recommendation', deleteQuestion: 'Do you really want to delete “{{title}}”?', deleted: 'The recommendation was deleted.', deleteFailed: 'The recommendation could not be deleted.',
    required: 'Please complete all required fields.', uploadFailed: 'Upload failed', uploadTip: '{{error}}\n\nTip: Make sure the “public-images” bucket exists in Supabase.', continueWithoutImage: 'Continue without image',
    product: 'View product', updated: 'The recommendation was updated.', created: 'The recommendation was created.', saveFailed: 'The recommendation could not be saved.\n\n{{error}}',
    linkUnsupported: 'This link cannot be opened.', linkFailed: 'The link could not be opened.', copiedTitle: '✅ Copied!', copiedMessage: 'The discount code “{{code}}” was copied to the clipboard.', copyFailed: 'The code could not be copied.',
    favorite: "Lotti's favorite", discountCode: 'Discount code:', reorderFailed: 'The order could not be saved.', add: 'New recommendation', loading: 'Loading recommendations …', emptyTitle: 'No recommendations yet', emptyAdmin: 'Add the first recommendation!', emptyUser: 'Check back soon for more great product recommendations!',
    title: "Lotti's recommendations", subtitle: 'Hand-picked products for you and your baby', editTitle: 'Edit recommendation',
    fieldTitle: 'Title *', titlePlaceholder: 'e.g. best baby carrier', fieldDescription: 'Description *', descriptionPlaceholder: 'Describe the product …', fieldImage: 'Product image', changeImage: 'Change image', chooseImage: 'Choose image', or: 'or', imageUrlPlaceholder: 'Enter image URL (https://…)', fieldLink: 'Product link *',
    favoriteHint: 'Optional: Shows the pinned favorite badge', fieldButton: 'Button text', buttonHint: 'Optional: Default is “View product”', fieldDiscount: 'Discount code', discountPlaceholder: 'e.g. LOTTI10', discountHint: 'Optional: Checkout code (e.g. LOTTI10 for 10% off)', uploading: 'Uploading image …', saving: 'Saving …',
  },
  es: {
    error: 'Error', success: 'Correcto', cancel: 'Cancelar', delete: 'Eliminar', save: 'Guardar', ok: 'Aceptar', unknownError: 'Error desconocido',
    loadFailed: 'No se pudieron cargar los datos.', permissionTitle: 'Permiso necesario', permissionMessage: 'Permite el acceso a tus fotos.', imageFailed: 'No se pudo seleccionar la imagen.',
    deleteTitle: 'Eliminar recomendación', deleteQuestion: '¿Quieres eliminar “{{title}}”?', deleted: 'La recomendación se ha eliminado.', deleteFailed: 'No se pudo eliminar la recomendación.',
    required: 'Completa todos los campos obligatorios.', uploadFailed: 'Error al subir', uploadTip: '{{error}}\n\nConsejo: comprueba que el bucket «public-images» exista en Supabase.', continueWithoutImage: 'Continuar sin imagen',
    product: 'Ver producto', updated: 'La recomendación se ha actualizado.', created: 'La recomendación se ha creado.', saveFailed: 'No se pudo guardar la recomendación.\n\n{{error}}',
    linkUnsupported: 'No se puede abrir este enlace.', linkFailed: 'No se pudo abrir el enlace.', copiedTitle: '✅ ¡Copiado!', copiedMessage: 'El código de descuento «{{code}}» se ha copiado al portapapeles.', copyFailed: 'No se pudo copiar el código.',
    favorite: 'Favorito de Lotti', discountCode: 'Código de descuento:', reorderFailed: 'No se pudo guardar el orden.', add: 'Nueva recomendación', loading: 'Cargando recomendaciones …', emptyTitle: 'Aún no hay recomendaciones', emptyAdmin: '¡Añade la primera recomendación!', emptyUser: '¡Vuelve pronto para ver nuevas recomendaciones!',
    title: 'Recomendaciones de Lotti', subtitle: 'Productos elegidos para ti y tu bebé', editTitle: 'Editar recomendación',
    fieldTitle: 'Título *', titlePlaceholder: 'p. ej., el mejor portabebés', fieldDescription: 'Descripción *', descriptionPlaceholder: 'Describe el producto …', fieldImage: 'Imagen del producto', changeImage: 'Cambiar imagen', chooseImage: 'Elegir imagen', or: 'o', imageUrlPlaceholder: 'Introduce la URL de la imagen (https://…)', fieldLink: 'Enlace del producto *',
    favoriteHint: 'Opcional: muestra la insignia de favorito', fieldButton: 'Texto del botón', buttonHint: 'Opcional: el valor predeterminado es «Ver producto»', fieldDiscount: 'Código de descuento', discountPlaceholder: 'p. ej., LOTTI10', discountHint: 'Opcional: código para la compra (p. ej., LOTTI10 para un 10 %)', uploading: 'Subiendo imagen …', saving: 'Guardando …',
  },
} as const;

export type RecommendationsTranslationKey = keyof typeof copy.de;

export const translateRecommendations = (locale: AppLocale, key: RecommendationsTranslationKey, params?: Record<string, string | number>) => {
  let value: string = copy[locale][key] ?? copy.de[key];
  for (const [name, replacement] of Object.entries(params ?? {})) value = value.replaceAll(`{{${name}}}`, String(replacement));
  return value;
};
