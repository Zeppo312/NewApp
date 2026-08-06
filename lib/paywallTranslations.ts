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
      { label: 'Sleep, breastfeeding & diaper trackers', lite: true, standard: true, premium: true },
      { label: 'Pregnancy: contraction tracker & checklists', lite: true, standard: true, premium: true },
      { label: 'Weight & growth charts', lite: true, standard: true, premium: true },
      { label: 'Milestones & tooth tracker', lite: true, standard: true, premium: true },
      { label: 'Complete history (Lite: last 7 days)', lite: false, standard: true, premium: true },
      { label: 'Partner connection: track together', lite: false, standard: true, premium: true },
      { label: 'Daily overview, planner & shopping lists', lite: false, standard: true, premium: true },
      { label: 'Weekly moments & memory collection', lite: false, standard: true, premium: true },
      { label: 'Recipes & complementary feeding support', lite: false, standard: true, premium: true },
      { label: 'Insights & PDF exports', lite: false, standard: true, premium: true },
      { label: '✨ Personal pregnancy morning briefing', lite: false, standard: false, premium: true },
      { label: '✨ AI: voice logging – speak your entries', lite: false, standard: false, premium: true },
      { label: "✨ AI: Lotti's Care – daily insights", lite: false, standard: false, premium: true },
    ],
    quoteText: '“Starting the breastfeeding timer one-handed at 3 a.m. – and my partner can immediately see how the night went. Exactly what we needed.”',
    quoteAuthor: 'A Lotti mom, using it for 4 months', trustChips: ['Cancel anytime', 'Secure payment', 'For both of you'],
    restoreLabel: 'Restore purchases / refresh status', cancelLabel: 'Maybe later',
    legalText: 'An active subscription is required to use Lotti Baby. If {{storeProvider}} offers a free trial for your selected product, it will be shown in the store before purchase. Your store account is charged when the purchase is confirmed. Subscriptions renew automatically unless canceled in the store settings in time.',
    tiers: {
      premium: { visible: true, name: 'Lotti Premium', tagline: "Everything in Standard plus Lotti's AI features", ctaLabel: 'Start Premium', bullets: ["✨ Pregnancy briefing & Lotti's AI features", 'Partner connection for both of you', 'Planner, lists, weekly moments & recipes', 'Insights, memories & PDF exports'] },
      standard: { visible: true, name: 'Lotti Standard', tagline: 'Complete support for your family', ctaLabel: 'Start Standard', bullets: ['All trackers with complete history', 'Partner connection for both of you', 'Planner, lists, weekly moments & recipes', 'Insights, memories & PDF exports'] },
      lite: { visible: true, name: 'Lotti Lite', tagline: 'The simple way to start tracking', ctaLabel: 'Start Lite', bullets: ['All essential everyday trackers', 'Pregnancy support', 'Growth & milestones', 'History for the last 7 days'] },
    },
  },
  es: {
    brandLogo: 'Lotti Baby', brandSubtitle: 'Del embarazo al día a día con tu bebé', headline: 'Menos carga mental.\nMás tiempo para vuestro bebé.',
    subline: 'Lotti os acompaña desde el embarazo durante los primeros años: todo lo importante en un solo lugar, para ti y tu pareja.',
    socialProofText: 'Creada por madres y padres, para familias como la vuestra', popularBadge: 'La opción más popular',
    ctaNote: 'Cancela cuando quieras · {{billingLabel}} · Si {{storeProvider}} ofrece una prueba gratuita, la verás en la tienda antes de comprar.',
    compareTitle: '¿Qué incluye?',
    comparisonRows: [
      { label: 'Seguimiento de sueño, lactancia y pañales', lite: true, standard: true, premium: true },
      { label: 'Embarazo: contracciones y listas', lite: true, standard: true, premium: true },
      { label: 'Curvas de peso y crecimiento', lite: true, standard: true, premium: true },
      { label: 'Hitos y seguimiento dental', lite: true, standard: true, premium: true },
      { label: 'Historial completo (Lite: últimos 7 días)', lite: false, standard: true, premium: true },
      { label: 'Conexión de pareja: seguimiento conjunto', lite: false, standard: true, premium: true },
      { label: 'Resumen diario, agenda y listas de compra', lite: false, standard: true, premium: true },
      { label: 'Momentos semanales y colección de recuerdos', lite: false, standard: true, premium: true },
      { label: 'Recetas y acompañamiento en alimentación', lite: false, standard: true, premium: true },
      { label: 'Análisis y exportaciones PDF', lite: false, standard: true, premium: true },
      { label: '✨ Resumen personal diario del embarazo', lite: false, standard: false, premium: true },
      { label: '✨ IA: registro por voz', lite: false, standard: false, premium: true },
      { label: '✨ IA: Cuidados de Lotti – consejos diarios', lite: false, standard: false, premium: true },
    ],
    quoteText: '«Iniciar el temporizador de lactancia con una mano a las 3 de la mañana y que mi pareja vea cómo fue la noche. Justo lo que necesitábamos».',
    quoteAuthor: 'Una mamá Lotti, 4 meses con la app', trustChips: ['Cancela cuando quieras', 'Pago seguro', 'Para los dos'],
    restoreLabel: 'Restaurar compras / actualizar estado', cancelLabel: 'Quizá más tarde',
    legalText: 'Se necesita una suscripción activa para usar Lotti Baby. Si {{storeProvider}} ofrece una prueba gratuita para el producto elegido, aparecerá en la tienda antes de comprar. El cargo se realiza en tu cuenta de la tienda al confirmar la compra. Las suscripciones se renuevan automáticamente si no se cancelan a tiempo en los ajustes de la tienda.',
    tiers: {
      premium: { visible: true, name: 'Lotti Premium', tagline: 'Todo lo de Standard más las funciones de IA de Lotti', ctaLabel: 'Empezar Premium', bullets: ['✨ Resumen del embarazo y funciones de IA de Lotti', 'Conexión de pareja para ambos', 'Agenda, listas, momentos semanales y recetas', 'Análisis, recuerdos y exportaciones PDF'] },
      standard: { visible: true, name: 'Lotti Standard', tagline: 'Acompañamiento completo para vuestra familia', ctaLabel: 'Empezar Standard', bullets: ['Todos los seguimientos con historial completo', 'Conexión de pareja para ambos', 'Agenda, listas, momentos semanales y recetas', 'Análisis, recuerdos y exportaciones PDF'] },
      lite: { visible: true, name: 'Lotti Lite', tagline: 'La forma más sencilla de empezar', ctaLabel: 'Empezar Lite', bullets: ['Seguimientos básicos para el día a día', 'Acompañamiento durante el embarazo', 'Crecimiento e hitos', 'Historial de los últimos 7 días'] },
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
