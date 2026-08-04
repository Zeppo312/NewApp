import type { AppLocale } from '@/lib/localization';

export type LegalSection = { title: string; paragraphs?: string[]; bullets?: string[] };
export type LegalDocument = { headerTitle: string; headerSubtitle: string; pageTitle: string; updated?: string; sections: LegalSection[] };

const privacy: Record<'en' | 'es', LegalDocument> = {
  en: {
    headerTitle: 'Privacy', headerSubtitle: 'Privacy policy', pageTitle: 'Privacy policy', updated: 'Last updated: February 3, 2026',
    sections: [
      { title: 'Introduction', paragraphs: ['This policy explains what personal data we process, for which purposes, and to what extent when providing Lotti Baby, our websites, mobile applications, and related online presences. Terms apply to all people regardless of gender.'] },
      { title: 'Controller', paragraphs: ['Laura-Michelle Zeppenfeld, Tilburger Str. 31, 28259 Bremen, Germany', 'Email: support@lottibaby.de'] },
      { title: 'Data and people concerned', paragraphs: ['We may process account, contact, content, usage, device, communication, process, and log data relating to users and communication partners.'], bullets: ['Purposes include providing contractual services, communication, account login, security, administration, feedback, user-friendly operation, and technical infrastructure.'] },
      { title: 'Legal bases', bullets: ['Consent (Art. 6(1)(a) GDPR).', 'Performance of a contract and pre-contractual requests (Art. 6(1)(b) GDPR).', 'Compliance with legal obligations (Art. 6(1)(c) GDPR), where applicable.', 'Legitimate interests in secure, reliable, and user-friendly operation (Art. 6(1)(f) GDPR).'] },
      { title: 'Security', paragraphs: ['We use appropriate technical and organizational safeguards based on risk, including access controls, encrypted transmission, data minimization, availability measures, and procedures for exercising data-subject rights.'] },
      { title: 'Recipients and processors', paragraphs: ['Data is shared only where needed for the service, required by law, based on consent, or covered by a valid processing agreement. Service providers may include hosting and database infrastructure, authentication providers, notification services, weather data from Open-Meteo, and an AI service for personalized Care wording when that feature is enabled.'], bullets: ['Approximate weather location is rounded to about 1 km; precise location is not sent to Open-Meteo.', "Care may send daily values (sleep, feeds, diapers, weather), plus the baby's first name and age, to an AI service for personalized wording.", 'The at-my-limit selection is stored in your account but is not sent to the AI service.'] },
      { title: 'International transfers', paragraphs: ['If data is processed outside the EU/EEA, we use an adequacy decision, EU Standard Contractual Clauses, another legally recognized safeguard, or your explicit consent as required.'] },
      { title: 'Storage and deletion', paragraphs: ['We retain personal data only for as long as required for its purpose, contractual obligations, legal retention periods, security, or the establishment and defense of claims. Data is deleted or anonymized when the purpose and retention obligations no longer apply. Backups may be removed on a delayed cycle.'] },
      { title: 'Your rights', bullets: ['Withdraw consent at any time for the future.', 'Object to processing based on legitimate interests and to direct marketing.', 'Request access, correction, deletion, restriction, and data portability.', 'Lodge a complaint with a competent data protection authority.'] },
      { title: 'Hosting and logs', paragraphs: ['To deliver and protect the online service, hosting systems process technical connection and log data such as IP address, timestamps, requested resources, device/browser information, and error or security events. Logs are retained only as necessary for security and troubleshooting.'] },
      { title: 'Cookies and local storage', paragraphs: ['We use technically necessary storage to maintain sessions, preferences, and core app functions. Optional technologies are used only where the required consent or another valid legal basis exists. You can revoke consent and change device or browser settings at any time.'] },
      { title: 'Registration and account', paragraphs: ['Account creation and login require identifiers such as email address and authentication data. Additional profile and app content is processed to provide your account, synchronize data, link partners where requested, prevent misuse, and support account recovery.'] },
      { title: 'Single sign-on', paragraphs: ['If you choose sign-in through Apple or another supported provider, that provider confirms your identity and sends the account information needed for login. Apple’s own privacy policy applies to processing performed by Apple.'] },
      { title: 'Community and communication', paragraphs: ['Content you submit to community, publication, chat, support, or feedback functions is processed to display the content, enable communication, moderate misuse, and answer requests. Please avoid sharing unnecessary sensitive information.'] },
      { title: 'Changes', paragraphs: ['We update this policy when services, processing, or legal requirements change. The version shown in the app is the current version. If consent is required for a change, we will ask for it.'] },
      { title: 'Contact', paragraphs: ['For privacy questions or requests, contact support@lottibaby.de. You can export your data or request permanent account deletion from “Manage account & data” in the app.'] },
    ],
  },
  es: {
    headerTitle: 'Privacidad', headerSubtitle: 'Política de privacidad', pageTitle: 'Política de privacidad', updated: 'Última actualización: 3 de febrero de 2026',
    sections: [
      { title: 'Introducción', paragraphs: ['Esta política explica qué datos personales tratamos, con qué fines y en qué medida al ofrecer Lotti Baby, nuestros sitios web, aplicaciones móviles y presencias en línea relacionadas. Los términos se aplican a todas las personas con independencia de su género.'] },
      { title: 'Responsable', paragraphs: ['Laura-Michelle Zeppenfeld, Tilburger Str. 31, 28259 Bremen, Alemania', 'Correo electrónico: support@lottibaby.de'] },
      { title: 'Datos y personas afectadas', paragraphs: ['Podemos tratar datos de cuenta, contacto, contenido, uso, dispositivo, comunicación, procedimiento y registro relativos a usuarios y contactos.'], bullets: ['Los fines incluyen prestar los servicios contratados, comunicación, inicio de sesión, seguridad, administración, comentarios, facilidad de uso e infraestructura técnica.'] },
      { title: 'Bases jurídicas', bullets: ['Consentimiento (art. 6.1.a del RGPD).', 'Ejecución de un contrato y medidas precontractuales (art. 6.1.b del RGPD).', 'Cumplimiento de obligaciones legales (art. 6.1.c del RGPD), cuando corresponda.', 'Intereses legítimos en un funcionamiento seguro, fiable y fácil de usar (art. 6.1.f del RGPD).'] },
      { title: 'Seguridad', paragraphs: ['Aplicamos medidas técnicas y organizativas adecuadas al riesgo, como controles de acceso, transmisión cifrada, minimización de datos, medidas de disponibilidad y procedimientos para ejercer los derechos de las personas.'] },
      { title: 'Destinatarios y encargados', paragraphs: ['Solo compartimos datos cuando es necesario para el servicio, lo exige la ley, existe consentimiento o hay un contrato válido de encargo. Los proveedores pueden incluir alojamiento y bases de datos, autenticación, notificaciones, información meteorológica de Open-Meteo y un servicio de IA para personalizar los textos de Cuidados cuando la función está activada.'], bullets: ['La ubicación meteorológica aproximada se redondea a unos 1 km; no se envía la posición exacta a Open-Meteo.', 'Cuidados puede enviar valores diarios (sueño, tomas, pañales y tiempo), además del nombre y la edad del bebé, a un servicio de IA para personalizar el texto.', 'La selección del modo al límite se guarda en tu cuenta, pero no se envía al servicio de IA.'] },
      { title: 'Transferencias internacionales', paragraphs: ['Si se tratan datos fuera de la UE/EEE, usamos una decisión de adecuación, las cláusulas contractuales tipo de la UE, otra garantía reconocida o tu consentimiento explícito, según corresponda.'] },
      { title: 'Conservación y supresión', paragraphs: ['Conservamos los datos solo durante el tiempo necesario para su finalidad, obligaciones contractuales o legales, seguridad o defensa de reclamaciones. Después se eliminan o anonimizan. Las copias de seguridad pueden borrarse con cierto retraso.'] },
      { title: 'Tus derechos', bullets: ['Retirar el consentimiento en cualquier momento para el futuro.', 'Oponerte al tratamiento basado en intereses legítimos y al marketing directo.', 'Solicitar acceso, rectificación, supresión, limitación y portabilidad.', 'Presentar una reclamación ante una autoridad de protección de datos competente.'] },
      { title: 'Alojamiento y registros', paragraphs: ['Para prestar y proteger el servicio, los sistemas de alojamiento tratan datos técnicos de conexión y registro, como dirección IP, fecha y hora, recurso solicitado, dispositivo/navegador y eventos de error o seguridad. Solo se conservan el tiempo necesario para seguridad y resolución de problemas.'] },
      { title: 'Cookies y almacenamiento local', paragraphs: ['Usamos almacenamiento técnicamente necesario para sesiones, preferencias y funciones esenciales. Las tecnologías opcionales solo se usan con el consentimiento requerido u otra base válida. Puedes retirar el consentimiento y cambiar los ajustes del dispositivo o navegador.'] },
      { title: 'Registro y cuenta', paragraphs: ['El registro y el inicio de sesión requieren identificadores como correo electrónico y datos de autenticación. Los datos adicionales de perfil y de la app se tratan para prestar la cuenta, sincronizar información, vincular a la pareja si lo solicitas, evitar abusos y recuperar el acceso.'] },
      { title: 'Inicio de sesión único', paragraphs: ['Si eliges iniciar sesión con Apple u otro proveedor compatible, este confirma tu identidad y transmite la información necesaria para entrar. El tratamiento realizado por Apple se rige por su propia política de privacidad.'] },
      { title: 'Comunidad y comunicación', paragraphs: ['El contenido que envíes a comunidad, publicaciones, chat, soporte o comentarios se trata para mostrarlo, permitir la comunicación, moderar abusos y responder solicitudes. Evita compartir datos sensibles innecesarios.'] },
      { title: 'Cambios', paragraphs: ['Actualizamos esta política cuando cambian los servicios, el tratamiento o los requisitos legales. La versión mostrada en la app es la vigente. Si un cambio requiere consentimiento, te lo solicitaremos.'] },
      { title: 'Contacto', paragraphs: ['Para consultas o solicitudes de privacidad, escribe a support@lottibaby.de. Puedes exportar tus datos o solicitar la eliminación permanente de la cuenta desde «Gestionar cuenta y datos» en la app.'] },
    ],
  },
};

const terms: Record<'en' | 'es', LegalDocument> = {
  en: { headerTitle: 'Terms of use', headerSubtitle: 'App and subscription terms', pageTitle: 'Terms of use', updated: 'Last updated: March 7, 2026', sections: [
    { title: 'Scope', paragraphs: ['These terms govern the use of the Lotti Baby app, its content, functions, and subscriptions. The provider is Laura-Michelle Zeppenfeld, Tilburger Str. 31, 28259 Bremen, Germany.'] },
    { title: 'Service', paragraphs: ['Lotti Baby provides digital tools for pregnancy, everyday baby care, planning, and documentation. Features may evolve for technical, content, security, or legal reasons.'] },
    { title: 'Account and access', bullets: ['Some functions require an account.', 'Keep access credentials confidential and do not misuse them.', 'Use the app only in accordance with applicable law and these terms.'] },
    { title: 'Subscription, prices, and term', bullets: ['An active subscription is required. Any free trial offered by Apple or Google is shown in the purchase dialog.', 'The price displayed in the paywall at purchase is binding.', 'Billing uses the App Store or Google Play account used for purchase.', 'Subscriptions renew automatically unless canceled in the store settings before the current period ends.', 'Started billing periods are generally not refunded pro rata unless mandatory law or store rules require otherwise.'] },
    { title: 'Cancellation and management', paragraphs: ['Manage, cancel, and restore subscriptions using the relevant store settings or the functions provided in the app.'] },
    { title: 'No medical advice', paragraphs: ['Lotti Baby content is for general information, organization, and documentation. It does not replace medical advice, diagnosis, or treatment. Seek professional advice for health concerns or uncertainty.'] },
    { title: 'Permitted use', bullets: ['Do not infringe third-party rights, disrupt operation, or use the app for unlawful purposes.', 'Automated access, bypassing safeguards, and unauthorized copying of content are prohibited.'] },
    { title: 'Availability and changes', paragraphs: ['Continuous availability is not guaranteed. Maintenance, updates, technical incidents, or security measures may temporarily limit use.', 'The provider may adapt, expand, or discontinue functions where reasonably acceptable to users.'] },
    { title: 'Liability', paragraphs: ['Liability is unlimited for intent, gross negligence, injury to life, body, or health, and mandatory product-liability rules. Otherwise, liability applies only to breaches of essential contractual duties and is limited to typically foreseeable loss.'] },
    { title: 'Privacy and store terms', paragraphs: ['Information about personal-data processing is available in the in-app privacy policy. For iOS purchases, Apple’s Standard EULA may also apply: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'] },
    { title: 'Contact', paragraphs: ['support@lottibaby.de'] },
  ] },
  es: { headerTitle: 'Condiciones de uso', headerSubtitle: 'Condiciones de la app y suscripción', pageTitle: 'Condiciones de uso', updated: 'Última actualización: 7 de marzo de 2026', sections: [
    { title: 'Ámbito', paragraphs: ['Estas condiciones regulan el uso de la app Lotti Baby, sus contenidos, funciones y suscripciones. La proveedora es Laura-Michelle Zeppenfeld, Tilburger Str. 31, 28259 Bremen, Alemania.'] },
    { title: 'Servicio', paragraphs: ['Lotti Baby ofrece herramientas digitales para el embarazo, el día a día con el bebé, la planificación y la documentación. Las funciones pueden evolucionar por motivos técnicos, de contenido, seguridad o legales.'] },
    { title: 'Cuenta y acceso', bullets: ['Algunas funciones requieren una cuenta.', 'Mantén tus credenciales confidenciales y no las uses indebidamente.', 'Usa la app conforme a la ley aplicable y estas condiciones.'] },
    { title: 'Suscripción, precios y duración', bullets: ['Se necesita una suscripción activa. Las pruebas gratuitas de Apple o Google aparecen en el diálogo de compra.', 'El precio mostrado en la pantalla de pago al comprar es vinculante.', 'El cobro se realiza mediante la cuenta de App Store o Google Play usada para comprar.', 'La suscripción se renueva automáticamente si no se cancela en los ajustes de la tienda antes de terminar el periodo actual.', 'Los periodos ya iniciados no suelen reembolsarse proporcionalmente, salvo obligación legal o de la tienda.'] },
    { title: 'Cancelación y gestión', paragraphs: ['Gestiona, cancela y restaura suscripciones en los ajustes de la tienda correspondiente o mediante las funciones de la app.'] },
    { title: 'Sin asesoramiento médico', paragraphs: ['Los contenidos de Lotti Baby sirven para información, organización y documentación general. No sustituyen el consejo, diagnóstico ni tratamiento médico. Consulta a un profesional ante problemas de salud o dudas.'] },
    { title: 'Uso permitido', bullets: ['No vulneres derechos de terceros, alteres el funcionamiento ni uses la app con fines ilícitos.', 'Se prohíben los accesos automatizados, eludir protecciones y copiar contenidos sin autorización.'] },
    { title: 'Disponibilidad y cambios', paragraphs: ['No se garantiza disponibilidad ininterrumpida. El mantenimiento, las actualizaciones, incidencias técnicas o medidas de seguridad pueden limitar temporalmente el uso.', 'La proveedora puede adaptar, ampliar o retirar funciones cuando resulte razonable para los usuarios.'] },
    { title: 'Responsabilidad', paragraphs: ['La responsabilidad es ilimitada en caso de dolo, negligencia grave, daños a la vida, cuerpo o salud y normas obligatorias de responsabilidad por productos. En los demás casos solo se responde por obligaciones contractuales esenciales, con límite en el daño típicamente previsible.'] },
    { title: 'Privacidad y condiciones de la tienda', paragraphs: ['La política de privacidad de la app explica el tratamiento de datos personales. En compras de iOS también puede aplicarse la EULA estándar de Apple: https://www.apple.com/legal/internet-services/itunes/dev/stdeula/'] },
    { title: 'Contacto', paragraphs: ['support@lottibaby.de'] },
  ] },
};

const imprint: Record<'en' | 'es', LegalDocument> = {
  en: { headerTitle: 'Legal notice', headerSubtitle: 'Provider information', pageTitle: 'Legal notice', sections: [
    { title: 'Provider', paragraphs: ['Name/company: Laura-Michelle Zeppenfeld', 'Address: Tilburger Str. 31, 28259 Bremen, Germany', 'Status: Small business'] },
    { title: 'Contact', paragraphs: ['Email: support@lottibaby.de'] },
    { title: 'Authorized representative', paragraphs: ['Laura-Michelle Zeppenfeld'] },
    { title: 'Register and VAT ID (if available)', paragraphs: ['Register court: To be provided', 'Register number: To be provided', 'VAT identification number: To be provided'] },
    { title: 'Responsible for content', paragraphs: ['Laura-Michelle Zeppenfeld, Tilburger Str. 31, 28259 Bremen, Germany'] },
    { title: 'Dispute resolution', bullets: ['We are neither obliged nor willing to participate in dispute-resolution proceedings before a consumer arbitration board.', 'The European Commission provides an online dispute resolution platform: https://ec.europa.eu/consumers/odr/'] },
  ] },
  es: { headerTitle: 'Aviso legal', headerSubtitle: 'Información del proveedor', pageTitle: 'Aviso legal', sections: [
    { title: 'Proveedor', paragraphs: ['Nombre/empresa: Laura-Michelle Zeppenfeld', 'Dirección: Tilburger Str. 31, 28259 Bremen, Alemania', 'Estado: Pequeña empresa'] },
    { title: 'Contacto', paragraphs: ['Correo electrónico: support@lottibaby.de'] },
    { title: 'Representante autorizada', paragraphs: ['Laura-Michelle Zeppenfeld'] },
    { title: 'Registro e IVA (si están disponibles)', paragraphs: ['Juzgado de registro: Pendiente', 'Número de registro: Pendiente', 'Número de identificación fiscal: Pendiente'] },
    { title: 'Responsable del contenido', paragraphs: ['Laura-Michelle Zeppenfeld, Tilburger Str. 31, 28259 Bremen, Alemania'] },
    { title: 'Resolución de litigios', bullets: ['No estamos obligados ni dispuestos a participar en procedimientos de resolución ante una junta arbitral de consumo.', 'La Comisión Europea ofrece una plataforma de resolución de litigios en línea: https://ec.europa.eu/consumers/odr/'] },
  ] },
};

export const getLegalDocument = (locale: AppLocale, kind: 'privacy' | 'terms' | 'imprint'): LegalDocument | null => {
  if (locale === 'de') return null;
  return ({ privacy, terms, imprint } as const)[kind][locale];
};
