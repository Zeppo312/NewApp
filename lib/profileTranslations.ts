/**
 * Translation boundary for the profile screen.
 *
 * German stays active until the app has a global locale provider. The profile
 * UI can then be switched by replacing its default locale with that provider.
 */
export type ProfileLocale = 'de' | 'en' | 'es';

export const DEFAULT_PROFILE_LOCALE: ProfileLocale = 'de';

const de = {
  'common.error': 'Fehler',
  'common.notice': 'Hinweis',
  'common.cancel': 'Abbrechen',
  'common.delete': 'Löschen',
  'common.ok': 'OK',
  'screen.title': 'Profil',
  'screen.subtitle': 'Dein Konto, deine Community, deine Daten',
  'screen.loading': 'Profil wird geladen …',
  'hero.eyebrow': 'DEIN PROFIL',
  'hero.fallbackName': 'Schön, dass du da bist',
  'hero.description': 'Gestalte, wie du in LottiBaby und der Community sichtbar bist.',
  'section.personal': 'Persönliche Daten',
  'section.personalDescription': 'Deine Kontaktdaten und dein Name',
  'section.community': 'Community',
  'section.communityDescription': 'So sehen dich andere Eltern',
  'section.baby': 'Mein Baby',
  'section.babyDescription': 'Babydaten und Entwicklung verwalten',
  'section.security': 'Konto & Sicherheit',
  'photo.choose': 'Foto wählen',
  'photo.change': 'Foto ändern',
  'photo.remove': 'Entfernen',
  'photo.delete': 'Endgültig löschen',
  'photo.editA11y': 'Profilbild auswählen oder ändern',
  'photo.permissionTitle': 'Berechtigung erforderlich',
  'photo.permissionMessage': 'Bitte erlaube den Zugriff auf deine Fotos.',
  'photo.pickFailed': 'Das Profilbild konnte nicht ausgewählt werden.',
  'photo.deleteTitle': 'Profilbild löschen',
  'photo.deleteMessage': 'Möchtest du dein aktuelles Profilbild wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.',
  'photo.deletedTitle': 'Profilbild gelöscht',
  'photo.deletedMessage': 'Dein Profilbild wurde entfernt.',
  'photo.deleteFailed': 'Das Profilbild konnte nicht gelöscht werden.',
  'field.email': 'E-Mail',
  'field.emailPlaceholder': 'Deine E-Mail-Adresse',
  'field.firstName': 'Vorname',
  'field.firstNamePlaceholder': 'Dein Vorname',
  'field.lastName': 'Nachname',
  'field.lastNamePlaceholder': 'Dein Nachname',
  'field.username': 'Username',
  'field.usernamePlaceholder': '@deinname',
  'field.role': 'Rolle',
  'field.roleMama': 'Mama',
  'field.rolePapa': 'Papa',
  'email.change': 'E-Mail ändern',
  'email.pending': 'Neue E-Mail ausstehend: {{email}} (bitte bestätigen)',
  'email.overlayLabel': 'Neue E-Mail-Adresse',
  'email.overlayPlaceholder': 'deine@email.de',
  'email.signIn': 'Bitte melde dich an, um deine E-Mail zu ändern.',
  'email.required': 'Bitte gib eine E-Mail-Adresse ein.',
  'email.invalid': 'Bitte gib eine gültige E-Mail-Adresse ein.',
  'email.unchanged': 'Diese E-Mail ist bereits hinterlegt.',
  'email.confirmTitle': 'E-Mail ändern',
  'email.confirmMessage': 'Möchtest du deine E-Mail-Adresse auf\n{{email}}\nändern?\n\nWir senden dir eine Bestätigungs-E-Mail an die neue Adresse.',
  'email.almostDoneTitle': 'Fast fertig',
  'email.almostDoneMessage': 'Wir haben dir eine Bestätigungs-E-Mail an {{email}} gesendet.\n\nBitte öffne den Link in der E-Mail, um die Änderung abzuschließen.',
  'email.changeFailed': 'Die E-Mail konnte nicht geändert werden. Bitte versuche es später erneut.',
  'community.usernameHint': 'Lege hier deinen Community-Username fest. Danach geht es direkt zurück zur Community.',
  'community.avatarLabel': 'Community-Profilbild',
  'community.avatarTitle': 'Profilbild anzeigen',
  'community.avatarDescription': 'Sichtbar in der Community und in Benachrichtigungen. Sonst verwenden wir einen neutralen Avatar.',
  'community.usernameRequiredTitle': 'Community-Username',
  'community.usernameRequiredMessage': 'Bitte gib einen Username an, bevor du in der Community schreibst.',
  'baby.description': 'Baby-Daten, Geburtstermin, Geschlecht und Entwicklung bearbeitest du gesammelt auf der Seite „Mein Baby“.',
  'baby.open': 'Zu „Mein Baby“',
  'save.title': 'Änderungen speichern',
  'save.loading': 'Wird gespeichert …',
  'save.description': 'Deine Profildaten sicher aktualisieren',
  'save.signIn': 'Bitte melde dich an, um deine Daten zu speichern.',
  'save.successTitle': 'Gespeichert',
  'save.successMessage': 'Deine Daten wurden erfolgreich gespeichert.',
  'save.failed': 'Deine Daten konnten nicht gespeichert werden.',
  'load.failed': 'Deine Daten konnten nicht geladen werden.',
  'password.title': 'Passwort ändern',
  'password.loading': 'E-Mail wird gesendet …',
  'password.description': 'Sicheren Bestätigungslink per E-Mail erhalten',
  'password.emailMissing': 'Keine E-Mail-Adresse gefunden.',
  'password.confirmMessage': 'Wir senden dir eine Bestätigungs-E-Mail mit einem Link zum Ändern deines Passworts.',
  'password.send': 'E-Mail senden',
  'password.sentTitle': 'E-Mail gesendet',
  'password.sentMessage': 'Wir haben dir einen Link zum Ändern deines Passworts geschickt. Bitte prüfe deinen Posteingang und gegebenenfalls den Spam-Ordner.',
  'password.sendFailed': 'Die E-Mail zum Zurücksetzen des Passworts konnte nicht gesendet werden.',
  'delete.title': 'Profil & Konto löschen',
  'delete.loading': 'Profil wird gelöscht …',
  'delete.description': 'Profil, Konto und alle Daten dauerhaft entfernen',
  'delete.confirmMessage': 'Möchtest du dein Profil und dein Konto wirklich löschen? Alle gespeicherten Daten werden dauerhaft entfernt.\n\n{{warning}}',
  'delete.subscriptionWarning': 'Das Löschen deines Kontos beendet dein Abo im {{store}} nicht automatisch. Falls du ein aktives Store-Abo hast, kann die Abrechnung weiterlaufen. Bitte prüfe oder kündige dein Abo vorher über „Abo verwalten“.{{apple}}',
  'delete.appleWarning': '\n\nDa dein Konto mit „Mit Apple anmelden“ verknüpft ist, fordern wir im nächsten Schritt eine Apple-Bestätigung an.',
  'delete.manageSubscription': 'Abo verwalten',
  'delete.warningFailed': 'Der Löschhinweis konnte nicht geladen werden. Bitte versuche es erneut.',
  'delete.signIn': 'Bitte melde dich an, um dein Profil zu löschen.',
  'delete.deletedTitle': 'Konto gelöscht',
  'delete.deletedMessage': 'Dein Profil und Konto wurden gelöscht. Du wirst jetzt abgemeldet.',
  'delete.failed': 'Dein Profil konnte nicht gelöscht werden.',
} as const;

export type ProfileTranslationKey = keyof typeof de;
type Catalog = Record<ProfileTranslationKey, string>;

const en: Catalog = {
  'common.error': 'Error', 'common.notice': 'Note', 'common.cancel': 'Cancel', 'common.delete': 'Delete', 'common.ok': 'OK',
  'screen.title': 'Profile', 'screen.subtitle': 'Your account, community, and data', 'screen.loading': 'Loading profile …',
  'hero.eyebrow': 'YOUR PROFILE', 'hero.fallbackName': 'It’s lovely to have you here', 'hero.description': 'Choose how you appear in LottiBaby and the community.',
  'section.personal': 'Personal details', 'section.personalDescription': 'Your contact details and name', 'section.community': 'Community', 'section.communityDescription': 'How other parents see you', 'section.baby': 'My baby', 'section.babyDescription': 'Manage baby details and development', 'section.security': 'Account & security',
  'photo.choose': 'Choose photo', 'photo.change': 'Change photo', 'photo.remove': 'Remove', 'photo.delete': 'Delete permanently', 'photo.editA11y': 'Choose or change profile picture', 'photo.permissionTitle': 'Permission required', 'photo.permissionMessage': 'Please allow access to your photos.', 'photo.pickFailed': 'The profile picture could not be selected.', 'photo.deleteTitle': 'Delete profile picture', 'photo.deleteMessage': 'Do you really want to delete your current profile picture? This action cannot be undone.', 'photo.deletedTitle': 'Profile picture deleted', 'photo.deletedMessage': 'Your profile picture has been removed.', 'photo.deleteFailed': 'The profile picture could not be deleted.',
  'field.email': 'Email', 'field.emailPlaceholder': 'Your email address', 'field.firstName': 'First name', 'field.firstNamePlaceholder': 'Your first name', 'field.lastName': 'Last name', 'field.lastNamePlaceholder': 'Your last name', 'field.username': 'Username', 'field.usernamePlaceholder': '@yourname', 'field.role': 'Role', 'field.roleMama': 'Mom', 'field.rolePapa': 'Dad',
  'email.change': 'Change email', 'email.pending': 'New email pending: {{email}} (please confirm)', 'email.overlayLabel': 'New email address', 'email.overlayPlaceholder': 'you@example.com', 'email.signIn': 'Please sign in to change your email.', 'email.required': 'Please enter an email address.', 'email.invalid': 'Please enter a valid email address.', 'email.unchanged': 'This email is already linked to your account.', 'email.confirmTitle': 'Change email', 'email.confirmMessage': 'Would you like to change your email address to\n{{email}}?\n\nWe’ll send a confirmation email to the new address.', 'email.almostDoneTitle': 'Almost done', 'email.almostDoneMessage': 'We sent a confirmation email to {{email}}.\n\nOpen the link in that email to complete the change.', 'email.changeFailed': 'Your email could not be changed. Please try again later.',
  'community.usernameHint': 'Choose your community username here. You’ll return directly to the community afterwards.', 'community.avatarLabel': 'Community profile picture', 'community.avatarTitle': 'Show profile picture', 'community.avatarDescription': 'Visible in the community and notifications. Otherwise, we’ll use a neutral avatar.', 'community.usernameRequiredTitle': 'Community username', 'community.usernameRequiredMessage': 'Please choose a username before posting in the community.',
  'baby.description': 'Manage baby details, due date, sex, and development together on the “My baby” page.', 'baby.open': 'Open “My baby”',
  'save.title': 'Save changes', 'save.loading': 'Saving …', 'save.description': 'Securely update your profile details', 'save.signIn': 'Please sign in to save your details.', 'save.successTitle': 'Saved', 'save.successMessage': 'Your details were saved successfully.', 'save.failed': 'Your details could not be saved.', 'load.failed': 'Your details could not be loaded.',
  'password.title': 'Change password', 'password.loading': 'Sending email …', 'password.description': 'Receive a secure confirmation link by email', 'password.emailMissing': 'No email address was found.', 'password.confirmMessage': 'We’ll email you a confirmation link to change your password.', 'password.send': 'Send email', 'password.sentTitle': 'Email sent', 'password.sentMessage': 'We sent you a link to change your password. Please check your inbox and spam folder.', 'password.sendFailed': 'The password reset email could not be sent.',
  'delete.title': 'Delete profile & account', 'delete.loading': 'Deleting profile …', 'delete.description': 'Permanently remove your profile, account, and all data', 'delete.confirmMessage': 'Do you really want to delete your profile and account? All saved data will be permanently removed.\n\n{{warning}}', 'delete.subscriptionWarning': 'Deleting your account does not automatically cancel your {{store}} subscription. Billing may continue if you have an active store subscription. Review or cancel it first using “Manage subscription”.{{apple}}', 'delete.appleWarning': '\n\nBecause your account is linked to Sign in with Apple, we’ll ask for Apple confirmation in the next step.', 'delete.manageSubscription': 'Manage subscription', 'delete.warningFailed': 'The deletion notice could not be loaded. Please try again.', 'delete.signIn': 'Please sign in to delete your profile.', 'delete.deletedTitle': 'Account deleted', 'delete.deletedMessage': 'Your profile and account have been deleted. You will now be signed out.', 'delete.failed': 'Your profile could not be deleted.',
};

const es: Catalog = {
  'common.error': 'Error', 'common.notice': 'Aviso', 'common.cancel': 'Cancelar', 'common.delete': 'Eliminar', 'common.ok': 'Aceptar',
  'screen.title': 'Perfil', 'screen.subtitle': 'Tu cuenta, tu comunidad y tus datos', 'screen.loading': 'Cargando perfil …',
  'hero.eyebrow': 'TU PERFIL', 'hero.fallbackName': 'Qué alegría tenerte aquí', 'hero.description': 'Elige cómo apareces en LottiBaby y en la comunidad.',
  'section.personal': 'Datos personales', 'section.personalDescription': 'Tus datos de contacto y tu nombre', 'section.community': 'Comunidad', 'section.communityDescription': 'Cómo te ven otras familias', 'section.baby': 'Mi bebé', 'section.babyDescription': 'Gestiona los datos y el desarrollo del bebé', 'section.security': 'Cuenta y seguridad',
  'photo.choose': 'Elegir foto', 'photo.change': 'Cambiar foto', 'photo.remove': 'Quitar', 'photo.delete': 'Eliminar definitivamente', 'photo.editA11y': 'Elegir o cambiar la foto de perfil', 'photo.permissionTitle': 'Permiso necesario', 'photo.permissionMessage': 'Permite el acceso a tus fotos.', 'photo.pickFailed': 'No se pudo seleccionar la foto de perfil.', 'photo.deleteTitle': 'Eliminar foto de perfil', 'photo.deleteMessage': '¿Quieres eliminar tu foto de perfil actual? Esta acción no se puede deshacer.', 'photo.deletedTitle': 'Foto de perfil eliminada', 'photo.deletedMessage': 'Tu foto de perfil se ha eliminado.', 'photo.deleteFailed': 'No se pudo eliminar la foto de perfil.',
  'field.email': 'Correo electrónico', 'field.emailPlaceholder': 'Tu correo electrónico', 'field.firstName': 'Nombre', 'field.firstNamePlaceholder': 'Tu nombre', 'field.lastName': 'Apellidos', 'field.lastNamePlaceholder': 'Tus apellidos', 'field.username': 'Nombre de usuario', 'field.usernamePlaceholder': '@tunombre', 'field.role': 'Rol', 'field.roleMama': 'Mamá', 'field.rolePapa': 'Papá',
  'email.change': 'Cambiar correo', 'email.pending': 'Nuevo correo pendiente: {{email}} (confírmalo)', 'email.overlayLabel': 'Nuevo correo electrónico', 'email.overlayPlaceholder': 'tu@correo.es', 'email.signIn': 'Inicia sesión para cambiar tu correo.', 'email.required': 'Introduce un correo electrónico.', 'email.invalid': 'Introduce un correo electrónico válido.', 'email.unchanged': 'Este correo ya está vinculado a tu cuenta.', 'email.confirmTitle': 'Cambiar correo', 'email.confirmMessage': '¿Quieres cambiar tu correo electrónico a\n{{email}}?\n\nTe enviaremos un mensaje de confirmación a la nueva dirección.', 'email.almostDoneTitle': 'Casi listo', 'email.almostDoneMessage': 'Te hemos enviado un correo de confirmación a {{email}}.\n\nAbre el enlace del mensaje para completar el cambio.', 'email.changeFailed': 'No se pudo cambiar el correo. Inténtalo de nuevo más tarde.',
  'community.usernameHint': 'Elige aquí tu nombre de usuario. Después volverás directamente a la comunidad.', 'community.avatarLabel': 'Foto de perfil de la comunidad', 'community.avatarTitle': 'Mostrar foto de perfil', 'community.avatarDescription': 'Visible en la comunidad y en las notificaciones. Si no, usaremos un avatar neutro.', 'community.usernameRequiredTitle': 'Nombre de usuario de la comunidad', 'community.usernameRequiredMessage': 'Elige un nombre de usuario antes de publicar en la comunidad.',
  'baby.description': 'Gestiona los datos del bebé, la fecha prevista, el sexo y el desarrollo en la página «Mi bebé».', 'baby.open': 'Abrir «Mi bebé»',
  'save.title': 'Guardar cambios', 'save.loading': 'Guardando …', 'save.description': 'Actualiza tus datos de perfil de forma segura', 'save.signIn': 'Inicia sesión para guardar tus datos.', 'save.successTitle': 'Guardado', 'save.successMessage': 'Tus datos se han guardado correctamente.', 'save.failed': 'No se pudieron guardar tus datos.', 'load.failed': 'No se pudieron cargar tus datos.',
  'password.title': 'Cambiar contraseña', 'password.loading': 'Enviando correo …', 'password.description': 'Recibe un enlace seguro de confirmación por correo', 'password.emailMissing': 'No se encontró ninguna dirección de correo.', 'password.confirmMessage': 'Te enviaremos un enlace de confirmación para cambiar tu contraseña.', 'password.send': 'Enviar correo', 'password.sentTitle': 'Correo enviado', 'password.sentMessage': 'Te hemos enviado un enlace para cambiar tu contraseña. Revisa tu bandeja de entrada y la carpeta de spam.', 'password.sendFailed': 'No se pudo enviar el correo para restablecer la contraseña.',
  'delete.title': 'Eliminar perfil y cuenta', 'delete.loading': 'Eliminando perfil …', 'delete.description': 'Elimina permanentemente tu perfil, cuenta y todos los datos', 'delete.confirmMessage': '¿Quieres eliminar tu perfil y tu cuenta? Todos los datos guardados se eliminarán de forma permanente.\n\n{{warning}}', 'delete.subscriptionWarning': 'Eliminar tu cuenta no cancela automáticamente tu suscripción en {{store}}. La facturación puede continuar si tienes una suscripción activa. Revísala o cancélala antes en «Gestionar suscripción».{{apple}}', 'delete.appleWarning': '\n\nComo tu cuenta está vinculada con Iniciar sesión con Apple, solicitaremos una confirmación de Apple en el siguiente paso.', 'delete.manageSubscription': 'Gestionar suscripción', 'delete.warningFailed': 'No se pudo cargar el aviso de eliminación. Inténtalo de nuevo.', 'delete.signIn': 'Inicia sesión para eliminar tu perfil.', 'delete.deletedTitle': 'Cuenta eliminada', 'delete.deletedMessage': 'Tu perfil y tu cuenta se han eliminado. Ahora se cerrará tu sesión.', 'delete.failed': 'No se pudo eliminar tu perfil.',
};

export const PROFILE_TRANSLATIONS: Record<ProfileLocale, Catalog> = { de, en, es };

export const translateProfileText = (
  locale: ProfileLocale,
  key: ProfileTranslationKey,
  params: Record<string, string | number> = {},
) => {
  const template = PROFILE_TRANSLATIONS[locale]?.[key] ?? de[key] ?? key;
  return template.replace(/\{\{(\w+)\}\}/g, (_, token: string) =>
    String(params[token] ?? `{{${token}}}`),
  );
};
