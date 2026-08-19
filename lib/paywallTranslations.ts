import type { AppLocale } from '@/lib/localization';
import { clonePaywallPlansContent, DEFAULT_PAYWALL_CONTENT, type PaywallPlansContent } from '@/lib/paywallContent';

const ui = {
  de: { billingApple: 'Abrechnung über den App Store', billingGoogle: 'Abrechnung über Google Play', billing: 'Abrechnung', store: 'dem Store', signIn: 'Bitte zuerst anmelden.', unavailable: 'Zahlungen sind aktuell nicht verfügbar.', syncing: 'Kauf abgeschlossen – der Status wird noch synchronisiert. Bitte tippe „Status aktualisieren“.', purchaseFailed: 'Kauf fehlgeschlagen. Bitte versuche es erneut.', noneFound: 'Kein aktives Abo gefunden.', refreshFailed: 'Status-Aktualisierung fehlgeschlagen. Bitte versuche es erneut.', month: 'Monat', perMonth: 'pro Monat', perYear: 'pro Jahr', save: 'Spare {{percent}} %', monthly: 'Monatlich', yearly: 'Jährlich', yearlySavings: 'Jährlich · bis zu −{{percent}} %', moment: 'Einen Moment …', hidden: 'Ausgeblendet', refreshing: 'Aktualisiere …', privacy: 'Datenschutz', terms: 'Nutzungsbedingungen', imprint: 'Impressum', data: 'Konto & Daten verwalten' },
  en: { billingApple: 'Billed through the App Store', billingGoogle: 'Billed through Google Play', billing: 'Billing', store: 'the store', signIn: 'Please sign in first.', unavailable: 'Payments are currently unavailable.', syncing: 'Purchase complete – the status is still syncing. Tap “Refresh status”.', purchaseFailed: 'Purchase failed. Please try again.', noneFound: 'No active subscription found.', refreshFailed: 'Could not refresh the status. Please try again.', month: 'month', perMonth: 'per month', perYear: 'per year', save: 'Save {{percent}}%', monthly: 'Monthly', yearly: 'Yearly', yearlySavings: 'Yearly · save up to {{percent}}%', moment: 'One moment …', hidden: 'Hidden', refreshing: 'Refreshing …', privacy: 'Privacy', terms: 'Terms of use', imprint: 'Legal notice', data: 'Manage account & data' },
  es: { billingApple: 'Facturación mediante App Store', billingGoogle: 'Facturación mediante Google Play', billing: 'Facturación', store: 'la tienda', signIn: 'Inicia sesión primero.', unavailable: 'Los pagos no están disponibles en este momento.', syncing: 'Compra completada; el estado aún se está sincronizando. Pulsa «Actualizar estado».', purchaseFailed: 'La compra ha fallado. Inténtalo de nuevo.', noneFound: 'No se encontró ninguna suscripción activa.', refreshFailed: 'No se pudo actualizar el estado. Inténtalo de nuevo.', month: 'mes', perMonth: 'al mes', perYear: 'al año', save: 'Ahorra un {{percent}} %', monthly: 'Mensual', yearly: 'Anual', yearlySavings: 'Anual · ahorra hasta un {{percent}} %', moment: 'Un momento …', hidden: 'Oculto', refreshing: 'Actualizando …', privacy: 'Privacidad', terms: 'Condiciones de uso', imprint: 'Aviso legal', data: 'Gestionar cuenta y datos' },
} as const;

export type PaywallTranslationKey = keyof typeof ui.de;
export const translatePaywall = (locale: AppLocale, key: PaywallTranslationKey, params?: Record<string, string | number>) => {
  let value: string = ui[locale][key] ?? ui.de[key];
  for (const [name, replacement] of Object.entries(params ?? {})) value = value.replaceAll(`{{${name}}}`, String(replacement));
  return value;
};

const localizedDefaults: Record<Exclude<AppLocale, 'de'>, PaywallPlansContent> = {
  en: {
    brandLogo: 'Lotti Baby', brandSubtitle: 'Pregnancy through everyday life with baby', headline: 'Less mental load.\nMore time for your baby.',
    subline: 'Lotti supports you from pregnancy through the first years – everything that matters in one place, for you and your partner.',
    socialProofText: 'Created by parents – for families like yours', popularBadge: 'Most popular',
    ctaNote: 'Cancel anytime · {{billingLabel}} · If {{storeProvider}} offers a free trial, you will see it in the store before purchase.',
    compareTitle: "What's included?",
    comparisonRows: [
      { label: 'Sleep tracker, sleep phases & predictions', lite: true, standard: true, premium: true },
      { label: 'Breastfeeding, bottle, pumping, solids & water', lite: true, standard: true, premium: true },
      { label: 'Diapers, vitamin D & daily overview', lite: true, standard: true, premium: true },
      { label: 'Pregnancy: countdown, week & contraction tracker', lite: true, standard: true, premium: true },
      { label: 'Hospital bag checklist, birth plan & doctor questions', lite: true, standard: true, premium: true },
      { label: 'Baby names & baby profiles', lite: true, standard: true, premium: true },
      { label: 'Weight & growth charts', lite: true, standard: true, premium: true },
      { label: 'Milestones, tooth tracker & PDF photobook', lite: true, standard: true, premium: true },
      { label: 'Baby weather & clothing recommendations', lite: true, standard: true, premium: true },
      { label: 'Self-care & wellbeing', lite: true, standard: true, premium: true },
      { label: 'Reminders & notifications', lite: true, standard: true, premium: true },
      { label: 'Community, groups & private chats', lite: true, standard: true, premium: true },
      { label: 'Guides & blog', lite: true, standard: true, premium: true },
      { label: 'Product recommendations & print shop', lite: true, standard: true, premium: true },
      { label: 'Complete sleep & daily history', lite: false, standard: true, premium: true },
      { label: 'Partner connection: track together', lite: false, standard: true, premium: true },
      { label: 'Planner, appointments & shared calendar', lite: false, standard: true, premium: true },
      { label: 'Shopping lists, stock, alerts & loyalty cards', lite: false, standard: true, premium: true },
      { label: 'Weekly moments & memory collection', lite: false, standard: true, premium: true },
      { label: 'Recipes, generator, saved recipes & weaning videos', lite: false, standard: true, premium: true },
      { label: 'Insights, data reports & complete PDF export', lite: false, standard: true, premium: true },
      { label: '✨ Personal pregnancy morning briefing', lite: false, standard: false, premium: true },
      { label: '✨ AI: voice logging – speak your entries', lite: false, standard: false, premium: true },
      { label: "✨ AI: Lotti's Care – daily insights", lite: false, standard: false, premium: true },
      { label: '✨ AI: Ask Lotti – evidence-backed answers from your data', lite: false, standard: false, premium: true },
    ],
    quoteText: '“Starting the breastfeeding timer one-handed at 3 a.m. – and my partner can immediately see how the night went. Exactly what we needed.”',
    quoteAuthor: 'A Lotti mom, using it for 4 months', trustChips: ['Cancel anytime', 'Secure payment', 'For both of you'],
    restoreLabel: 'Restore purchases / refresh status', cancelLabel: 'Maybe later',
    legalText: 'An active subscription is required to use Lotti Baby. If {{storeProvider}} offers a free trial for your selected product, it will be shown in the store before purchase. Your store account is charged when the purchase is confirmed. Subscriptions renew automatically unless canceled in the store settings in time.',
    tiers: {
      premium: { visible: true, name: 'Lotti Premium', tagline: "Complete family support plus the briefing & Lotti's AI features", ctaLabel: 'Start Premium', bullets: ['Complete history, partner access, planner, lists, recipes & insights', '✨ Personal pregnancy briefing', "✨ Voice logging & Lotti's Care", '✨ Ask Lotti using relevant data from your routine'] },
      standard: { visible: true, name: 'Lotti Standard', tagline: 'Complete support for your family', ctaLabel: 'Start Standard', bullets: ['All core trackers with complete sleep & daily history', 'Partner connection, planner & shared calendar', 'Shopping lists, stock, alerts & loyalty cards', 'Weekly moments, recipes, insights & data export'] },
      lite: { visible: true, name: 'Lotti Lite', tagline: 'The simple way to start tracking', ctaLabel: 'Start Lite', bullets: ['All core trackers & 7 days of sleep and daily history', 'Pregnancy tools, growth & baby profiles', 'Milestones, photobook, baby weather & self-care', 'Community, groups, chats, guides & reminders'] },
    },
  },
  es: {
    brandLogo: 'Lotti Baby', brandSubtitle: 'Del embarazo al día a día con tu bebé', headline: 'Menos carga mental.\nMás tiempo para vuestro bebé.',
    subline: 'Lotti os acompaña desde el embarazo durante los primeros años: todo lo importante en un solo lugar, para ti y tu pareja.',
    socialProofText: 'Creada por madres y padres, para familias como la vuestra', popularBadge: 'La opción más popular',
    ctaNote: 'Cancela cuando quieras · {{billingLabel}} · Si {{storeProvider}} ofrece una prueba gratuita, la verás en la tienda antes de comprar.',
    compareTitle: '¿Qué incluye?',
    comparisonRows: [
      { label: 'Seguimiento del sueño, fases y predicciones', lite: true, standard: true, premium: true },
      { label: 'Lactancia, biberón, extracción, sólidos y agua', lite: true, standard: true, premium: true },
      { label: 'Pañales, vitamina D y resumen diario', lite: true, standard: true, premium: true },
      { label: 'Embarazo: cuenta atrás, semana y contracciones', lite: true, standard: true, premium: true },
      { label: 'Lista para el hospital, plan de parto y preguntas médicas', lite: true, standard: true, premium: true },
      { label: 'Nombres y perfiles del bebé', lite: true, standard: true, premium: true },
      { label: 'Curvas de peso y crecimiento', lite: true, standard: true, premium: true },
      { label: 'Hitos, seguimiento dental y álbum en PDF', lite: true, standard: true, premium: true },
      { label: 'Tiempo para el bebé y recomendaciones de ropa', lite: true, standard: true, premium: true },
      { label: 'Autocuidado y bienestar', lite: true, standard: true, premium: true },
      { label: 'Recordatorios y notificaciones', lite: true, standard: true, premium: true },
      { label: 'Comunidad, grupos y chats privados', lite: true, standard: true, premium: true },
      { label: 'Guías y blog', lite: true, standard: true, premium: true },
      { label: 'Recomendaciones de productos y tienda de impresiones', lite: true, standard: true, premium: true },
      { label: 'Historial completo de sueño y del día', lite: false, standard: true, premium: true },
      { label: 'Conexión de pareja: seguimiento conjunto', lite: false, standard: true, premium: true },
      { label: 'Agenda, citas y calendario compartido', lite: false, standard: true, premium: true },
      { label: 'Listas, existencias, avisos y tarjetas de fidelidad', lite: false, standard: true, premium: true },
      { label: 'Momentos semanales y colección de recuerdos', lite: false, standard: true, premium: true },
      { label: 'Recetas, generador, recetas guardadas y vídeos de alimentación', lite: false, standard: true, premium: true },
      { label: 'Análisis, informes y exportación completa en PDF', lite: false, standard: true, premium: true },
      { label: '✨ Resumen personal diario del embarazo', lite: false, standard: false, premium: true },
      { label: '✨ IA: registro por voz', lite: false, standard: false, premium: true },
      { label: '✨ IA: Cuidados de Lotti – consejos diarios', lite: false, standard: false, premium: true },
      { label: '✨ IA: Pregunta a Lotti – respuestas basadas en tus datos', lite: false, standard: false, premium: true },
    ],
    quoteText: '«Iniciar el temporizador de lactancia con una mano a las 3 de la mañana y que mi pareja vea cómo fue la noche. Justo lo que necesitábamos».',
    quoteAuthor: 'Una mamá Lotti, 4 meses con la app', trustChips: ['Cancela cuando quieras', 'Pago seguro', 'Para los dos'],
    restoreLabel: 'Restaurar compras / actualizar estado', cancelLabel: 'Quizá más tarde',
    legalText: 'Se necesita una suscripción activa para usar Lotti Baby. Si {{storeProvider}} ofrece una prueba gratuita para el producto elegido, aparecerá en la tienda antes de comprar. El cargo se realiza en tu cuenta de la tienda al confirmar la compra. Las suscripciones se renuevan automáticamente si no se cancelan a tiempo en los ajustes de la tienda.',
    tiers: {
      premium: { visible: true, name: 'Lotti Premium', tagline: 'Acompañamiento familiar completo más el resumen y las funciones de IA de Lotti', ctaLabel: 'Empezar Premium', bullets: ['Historial completo, acceso en pareja, agenda, listas, recetas y análisis', '✨ Resumen personal del embarazo', '✨ Registro por voz y Cuidados de Lotti', '✨ Pregunta a Lotti con datos relevantes de vuestra rutina'] },
      standard: { visible: true, name: 'Lotti Standard', tagline: 'Acompañamiento completo para vuestra familia', ctaLabel: 'Empezar Standard', bullets: ['Todos los seguimientos con historial completo de sueño y del día', 'Conexión de pareja, agenda y calendario compartido', 'Listas, existencias, avisos y tarjetas de fidelidad', 'Momentos, recetas, análisis y exportación de datos'] },
      lite: { visible: true, name: 'Lotti Lite', tagline: 'La forma más sencilla de empezar', ctaLabel: 'Empezar Lite', bullets: ['Seguimientos básicos y 7 días de historial', 'Herramientas de embarazo, crecimiento y perfiles', 'Hitos, álbum, tiempo para el bebé y autocuidado', 'Comunidad, grupos, chats, guías y recordatorios'] },
    },
  },
};

const translateIfDefault = (source: string, german: string, localized: string) => source === german ? localized : source;

export const localizePaywallPlansContent = (locale: AppLocale, source: PaywallPlansContent): PaywallPlansContent => {
  if (locale === 'de') return clonePaywallPlansContent(source);
  const german = DEFAULT_PAYWALL_CONTENT.plans;
  const target = localizedDefaults[locale];
  const fields = ['brandLogo', 'brandSubtitle', 'headline', 'subline', 'socialProofText', 'popularBadge', 'ctaNote', 'compareTitle', 'quoteText', 'quoteAuthor', 'restoreLabel', 'cancelLabel', 'legalText'] as const;
  const result = clonePaywallPlansContent(source);
  for (const field of fields) result[field] = translateIfDefault(source[field], german[field], target[field]);
  result.trustChips = source.trustChips.map((value, index) => translateIfDefault(value, german.trustChips[index] ?? '', target.trustChips[index] ?? value));
  result.comparisonRows = source.comparisonRows.map((row, index) => ({ ...row, label: translateIfDefault(row.label, german.comparisonRows[index]?.label ?? '', target.comparisonRows[index]?.label ?? row.label) }));
  for (const tierId of ['premium', 'standard', 'lite'] as const) {
    const sourceTier = source.tiers[tierId]; const germanTier = german.tiers[tierId]; const targetTier = target.tiers[tierId];
    result.tiers[tierId] = { ...sourceTier, name: translateIfDefault(sourceTier.name, germanTier.name, targetTier.name), tagline: translateIfDefault(sourceTier.tagline, germanTier.tagline, targetTier.tagline), ctaLabel: translateIfDefault(sourceTier.ctaLabel, germanTier.ctaLabel, targetTier.ctaLabel), bullets: sourceTier.bullets.map((value, index) => translateIfDefault(value, germanTier.bullets[index] ?? '', targetTier.bullets[index] ?? value)) };
  }
  return result;
};
