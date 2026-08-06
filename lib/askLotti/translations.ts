import type { AppLocale } from "@/lib/localization";

const de = {
  title: "Frag Lotti",
  subtitle: "Alltagstipps – persönlich, wenn Daten passen",
  loading: "Lotti denkt nach und prüft passende Einträge …",
  intro:
    "Frag mich alles rund um euren Babyalltag. Ich gebe dir eine klare allgemeine Orientierung und beziehe passende Lotti-Daten automatisch mit ein.",
  placeholder: "Frag zu Schlaf, Ernährung, Größen oder eurem Alltag …",
  send: "Senden",
  remaining: "Heute noch {{count}} Fragen",
  source: "Aus euren Daten einbezogen",
  safety:
    "Ich nutze allgemeines Wissen und ergänze eure App-Daten, wenn sie wirklich zur Frage passen. Freie Notizen werden nicht an die KI gesendet.",
  safetyTitle: "So hilft dir Lotti",
  generalHelp: "Allgemeine Orientierung",
  personalHelp: "Eure Daten, wenn passend",
  assistant: "Deine Familienassistentin",
  general: "Allgemeine Orientierung",
  grounded: "Mit euren Daten ergänzt",
  suggestionsTitle: "Zum Beispiel",
  ready: "Lotti ist bereit",
  greeting:
    "Hallo! Frag mich einfach, was du rund um euren Babyalltag wissen möchtest. Wenn passende Einträge vorhanden sind, beziehe ich sie automatisch mit ein.",
  thanks: "Sehr gern! Wenn du noch etwas wissen möchtest, frag einfach weiter.",
  retry: "Noch einmal versuchen",
  tooLong: "Deine Frage darf höchstens 500 Zeichen lang sein.",
  invalidQuestion: "Bitte formuliere eine Frage zu euren Einträgen.",
  noBaby: "Bitte wähle zuerst ein Baby aus.",
  genericError:
    "Lotti konnte die Frage gerade nicht beantworten. Bitte versuche es später noch einmal.",
  sessionExpired: "Deine Anmeldung ist abgelaufen. Bitte melde dich erneut an.",
  serviceUnavailable:
    "Lotti ist gerade nicht erreichbar. Bitte versuche es in ein paar Minuten erneut.",
  rateLimit:
    "Du hast dein aktuelles Fragenlimit erreicht. Bitte versuche es später wieder.",
  premium: "„Frag Lotti“ ist in Lotti Premium enthalten.",
  q1: "Welche Windelgröße könnte als Nächstes passen?",
  q2: "Wie hat sich die Trinkmenge diese Woche entwickelt?",
  q3: "Wie viel Schlaf ist in diesem Alter üblich?",
  q4: "Fasse die letzten drei Tage für den Kinderarzt zusammen.",
  q5: "Was sollte mein Partner über den heutigen Tag wissen?",
  q6: "Plane morgen rund um den Arzttermin.",
};
type Key = keyof typeof de;
const en: Record<Key, string> = {
  title: "Ask Lotti",
  subtitle: "Everyday guidance, personalized when it helps",
  loading: "Lotti is thinking and checking relevant records …",
  intro:
    "Ask me anything about everyday life with your baby. I’ll give you clear general guidance and automatically add relevant insights from Lotti when available.",
  placeholder: "Ask about sleep, feeding, sizes, or your routine …",
  send: "Send",
  remaining: "{{count}} questions left today",
  source: "Included from your data",
  safety:
    "I use general knowledge and add your app data when it genuinely fits the question. Free-text notes are not sent to the AI.",
  tooLong: "Your question can be up to 500 characters.",
  noBaby: "Please select a baby first.",
  safetyTitle: "How Lotti helps",
  generalHelp: "General guidance",
  personalHelp: "Your data when relevant",
  assistant: "Your family assistant",
  general: "General guidance",
  grounded: "Personalized with your data",
  suggestionsTitle: "For example",
  ready: "Lotti is ready",
  greeting:
    "Hello! Ask me anything about everyday life with your baby. When relevant records are available, I’ll automatically include them.",
  invalidQuestion: "Please ask a question about everyday life with your baby.",
  thanks:
    "You’re welcome! Ask away if there’s anything else you’d like to know.",
  retry: "Try again",
  genericError:
    "Lotti could not answer that right now. Please try again later.",
  sessionExpired: "Your session has expired. Please sign in again.",
  serviceUnavailable:
    "Lotti is temporarily unavailable. Please try again in a few minutes.",
  rateLimit:
    "You have reached the current question limit. Please try again later.",
  premium: "Ask Lotti is included with Lotti Premium.",
  q1: "Which diaper size might fit next?",
  q2: "How has feeding volume changed this week?",
  q3: "How much sleep is typical at this age?",
  q4: "Summarize the last three days for the pediatrician.",
  q5: "What should my partner know about today?",
  q6: "Plan tomorrow around the doctor appointment.",
};
const es: Record<Key, string> = {
  title: "Pregunta a Lotti",
  subtitle: "Orientación diaria, personalizada cuando ayuda",
  loading: "Lotti está pensando y revisando datos relevantes …",
  intro:
    "Pregúntame cualquier cosa sobre el día a día con tu bebé. Te daré orientación general clara y añadiré automáticamente datos relevantes de Lotti cuando existan.",
  placeholder: "Pregunta sobre sueño, alimentación, tallas o rutina …",
  send: "Enviar",
  remaining: "Quedan {{count}} preguntas hoy",
  source: "Incluido de vuestros datos",
  safety:
    "Uso conocimientos generales y añado datos de la app cuando encajan de verdad con la pregunta. Las notas de texto libre no se envían a la IA.",
  tooLong: "La pregunta puede tener hasta 500 caracteres.",
  noBaby: "Selecciona primero un bebé.",
  safetyTitle: "Cómo ayuda Lotti",
  generalHelp: "Orientación general",
  personalHelp: "Vuestros datos si son relevantes",
  assistant: "Tu asistente familiar",
  general: "Orientación general",
  grounded: "Personalizada con vuestros datos",
  suggestionsTitle: "Por ejemplo",
  ready: "Lotti está lista",
  greeting:
    "¡Hola! Pregúntame cualquier cosa sobre el día a día con tu bebé. Si hay registros relevantes, los incluiré automáticamente.",
  invalidQuestion: "Haz una pregunta sobre el día a día con tu bebé.",
  thanks: "¡De nada! Si quieres saber algo más, sigue preguntando.",
  retry: "Intentar de nuevo",
  genericError: "Lotti no pudo responder ahora. Inténtalo de nuevo más tarde.",
  sessionExpired: "Tu sesión ha caducado. Inicia sesión de nuevo.",
  serviceUnavailable:
    "Lotti no está disponible en este momento. Inténtalo de nuevo en unos minutos.",
  rateLimit:
    "Has alcanzado el límite actual de preguntas. Inténtalo más tarde.",
  premium: "Pregunta a Lotti está incluido en Lotti Premium.",
  q1: "¿Qué talla de pañal podría ser la siguiente?",
  q2: "¿Cómo ha cambiado la cantidad de las tomas esta semana?",
  q3: "¿Cuánto sueño es habitual a esta edad?",
  q4: "Resume los últimos tres días para pediatría.",
  q5: "¿Qué debería saber mi pareja sobre hoy?",
  q6: "Planifica mañana alrededor de la cita médica.",
};

const catalogs: Record<AppLocale, Record<Key, string>> = { de, en, es };
export const translateAskLotti = (
  locale: AppLocale,
  key: Key,
  params: Record<string, string | number> = {},
) =>
  (catalogs[locale]?.[key] ?? de[key]).replace(
    /\{\{(\w+)\}\}/g,
    (_, token: string) => String(params[token] ?? `{{${token}}}`),
  );
export const askLottiSuggestions = (locale: AppLocale) =>
  (["q1", "q2", "q3", "q4", "q5", "q6"] as const).map((key) =>
    translateAskLotti(locale, key),
  );
