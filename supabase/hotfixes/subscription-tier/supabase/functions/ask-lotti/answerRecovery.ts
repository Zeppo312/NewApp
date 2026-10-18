import { isLikelyPromptInjection, isMedicalQuestion, type AskLottiLocale } from './guardrails.ts';

/** Useful, non-clinical fallback for the appointment-preparation quick prompt. */
export const checkupPreparationAnswer = (question: string, locale: AskLottiLocale): string | null => {
  if (isLikelyPromptInjection(question) || isMedicalQuestion(question)) return null;
  const appointment = /vorsorgetermin|vorsorgeuntersuchung|arzttermin|check[ -]?up|prenatal appointment|cita prenatal|revisi[oó]n prenatal/i.test(question);
  const preparation = /ansprechen|besprechen|fragen|vorbereiten|bring up|discuss|ask|prepare|preguntar|hablar|preparar/i.test(question);
  if (!appointment || !preparation) return null;
  return {
    de: 'Für deinen nächsten Vorsorgetermin kannst du diese Fragen notieren: Welche Untersuchungen stehen bei diesem Termin an? Welche weiteren Termine soll ich planen? Was sollte ich im Alltag beachten? Wen kann ich zwischen den Terminen bei Fragen erreichen? Ergänze, was dich persönlich beschäftigt, und nimm deine Notizen zum Gespräch mit.',
    en: 'For your next checkup, you can note these questions: What will happen at this appointment? Which follow-up appointments should I plan? What should I keep in mind in everyday life? Who can I contact with questions between appointments? Add anything that is on your mind and bring your notes to the visit.',
    es: 'Para tu próxima revisión puedes anotar estas preguntas: ¿Qué se hará en esta cita? ¿Qué próximas citas debo planificar? ¿Qué debo tener en cuenta en el día a día? ¿Con quién puedo contactar si tengo preguntas entre citas? Añade lo que te preocupe y lleva tus notas a la consulta.',
  }[locale];
};

/** Make the retry match the actual lexical/length guard instead of repeating a vague instruction. */
export const answerRetryInstruction = (hasEvidence: boolean) =>
  ` Your previous draft failed output validation. Rewrite it in 2 to 4 short sentences, at most ${hasEvidence ? 900 : 1200} characters. Do not use links, code, diagnosis, treatment or causal claims. Avoid even mentioning these rejected word stems, including in referrals or disclaimers: diagnos, dosierung, dosage, medikament, medication, verschreib, prescrib${hasEvidence ? '' : ', behandl, treat'}. A separate medical disclaimer is already displayed by the app. ${hasEvidence ? 'Write quantities as digits, not number words, and avoid causal connectors such as weil, daher, deshalb, because or porque.' : ''} For appointment preparation, suggest practical questions about the visit and follow-up appointments without clinical recommendations.`;
