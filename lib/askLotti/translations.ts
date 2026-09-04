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
  chats: "Chats",
  newChat: "Neuer Chat",
  chatsTitle: "Deine Chats",
  chatsEmpty:
    "Noch keine gespeicherten Chats. Stell Lotti eine Frage – der Verlauf bleibt auf diesem Gerät.",
  chatsHint: "Gespeichert nur auf diesem Gerät",
  deleteChat: "Chat löschen",
  deleteChatConfirm:
    "Diesen Chat wirklich löschen? Das lässt sich nicht rückgängig machen.",
  cancel: "Abbrechen",
  delete: "Löschen",
  close: "Schließen",
  today: "Heute",
  yesterday: "Gestern",
  subtitlePregnancy: "Begleitung in der Schwangerschaft – persönlich, wenn Daten passen",
  introPregnancy:
    "Frag mich alles rund um deine Schwangerschaft. Ich gebe dir eine klare allgemeine Orientierung für deine Woche und beziehe deine Check-ins, Termine und Vorbereitung automatisch mit ein.",
  placeholderPregnancy: "Frag zu deiner Woche, Selfcare, Terminen oder der Geburt …",
  greetingPregnancy:
    "Hallo! Frag mich einfach, was du rund um deine Schwangerschaft wissen möchtest. Wenn passende Einträge vorhanden sind, beziehe ich sie automatisch mit ein.",
  personalHelpPregnancy: "Deine Einträge, wenn passend",
  assistantPregnancy: "Deine Schwangerschaftsbegleiterin",
  p1: "In welcher Woche bin ich und was passiert gerade mit meinem Baby?",
  p2: "Wie sahen meine Selfcare-Check-ins diese Woche aus?",
  p3: "Ist meine Gewichtszunahme für meine Woche üblich?",
  p4: "Was sollte ich beim nächsten Vorsorgetermin ansprechen?",
  p5: "Wie weit bin ich mit Kliniktasche und Geburtsplan?",
  p6: "Wie kann ich in dieser Woche besser schlafen?",
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
  chats: "Chats",
  newChat: "New chat",
  chatsTitle: "Your chats",
  chatsEmpty:
    "No saved chats yet. Ask Lotti a question — the history stays on this device.",
  chatsHint: "Stored on this device only",
  deleteChat: "Delete chat",
  deleteChatConfirm: "Delete this chat? This cannot be undone.",
  cancel: "Cancel",
  delete: "Delete",
  close: "Close",
  today: "Today",
  yesterday: "Yesterday",
  subtitlePregnancy: "Pregnancy companion, personalized when it helps",
  introPregnancy:
    "Ask me anything about your pregnancy. I’ll give you clear general guidance for your week and automatically include your check-ins, appointments and preparation when they fit.",
  placeholderPregnancy: "Ask about your week, self-care, appointments, or birth …",
  greetingPregnancy:
    "Hello! Just ask me whatever you’d like to know about your pregnancy. If matching entries exist, I’ll include them automatically.",
  personalHelpPregnancy: "Your entries when relevant",
  assistantPregnancy: "Your pregnancy companion",
  p1: "Which week am I in and what is happening with my baby right now?",
  p2: "What did my self-care check-ins look like this week?",
  p3: "Is my weight gain typical for my week?",
  p4: "What should I bring up at my next checkup?",
  p5: "How far along am I with my hospital bag and birth plan?",
  p6: "How can I sleep better this week?",
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
  chats: "Chats",
  newChat: "Nuevo chat",
  chatsTitle: "Tus chats",
  chatsEmpty:
    "Aún no hay chats guardados. Pregunta a Lotti: el historial se queda en este dispositivo.",
  chatsHint: "Guardado solo en este dispositivo",
  deleteChat: "Eliminar chat",
  deleteChatConfirm: "¿Eliminar este chat? No se puede deshacer.",
  cancel: "Cancelar",
  delete: "Eliminar",
  close: "Cerrar",
  today: "Hoy",
  yesterday: "Ayer",
  subtitlePregnancy: "Acompañamiento en el embarazo, personalizado cuando ayuda",
  introPregnancy:
    "Pregúntame lo que quieras sobre tu embarazo. Te doy orientación general clara para tu semana e incluyo automáticamente tus check-ins, citas y preparación cuando encajan.",
  placeholderPregnancy: "Pregunta por tu semana, autocuidado, citas o el parto …",
  greetingPregnancy:
    "¡Hola! Pregúntame lo que quieras saber sobre tu embarazo. Si hay registros que encajan, los incluyo automáticamente.",
  personalHelpPregnancy: "Tus registros, cuando encajan",
  assistantPregnancy: "Tu acompañante en el embarazo",
  p1: "¿En qué semana estoy y qué le pasa a mi bebé ahora mismo?",
  p2: "¿Cómo fueron mis check-ins de autocuidado esta semana?",
  p3: "¿Mi aumento de peso es habitual para mi semana?",
  p4: "¿Qué debería comentar en mi próxima revisión?",
  p5: "¿Cómo voy con la bolsa del hospital y el plan de parto?",
  p6: "¿Cómo puedo dormir mejor esta semana?",
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
export const askLottiSuggestions = (
  locale: AppLocale,
  mode: "baby" | "pregnancy" = "baby",
) =>
  (mode === "pregnancy"
    ? (["p1", "p2", "p3", "p4", "p5", "p6"] as const)
    : (["q1", "q2", "q3", "q4", "q5", "q6"] as const)
  ).map((key) => translateAskLotti(locale, key));
